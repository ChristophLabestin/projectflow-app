import SwiftUI

// MARK: - QuickCreateSheet
//
// One companion sheet to create a Project, Task, Initiative or Personal task
// fast. Minimal required fields, smart defaults, reuses the existing store
// create methods. Presented from the Home header and every list's "+".

enum QuickCreateType: String, CaseIterable, Identifiable {
    case project
    case task
    case initiative
    case personal

    var id: String { rawValue }

    var title: String {
        switch self {
        case .project: return L10n.tr("quickCreate.type.project", fallback: "Project")
        case .task: return L10n.tr("quickCreate.type.task", fallback: "Task")
        case .initiative: return L10n.tr("quickCreate.type.initiative", fallback: "Initiative")
        case .personal: return L10n.tr("quickCreate.type.personal", fallback: "Personal")
        }
    }

    var icon: String {
        switch self {
        case .project: return "square.stack.3d.down.forward"
        case .task: return "checklist"
        case .initiative: return "flag"
        case .personal: return "person.crop.circle"
        }
    }

    var needsProject: Bool { self == .task || self == .initiative }
}

struct QuickCreateSheet: View {
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss

    let tenantId: String
    let projects: [Project]
    var defaultProjectId: String? = nil
    var initialType: QuickCreateType = .project
    let permissions: PermissionContext
    var onCreated: (() -> Void)? = nil

    @State private var type: QuickCreateType
    @State private var title: String = ""
    @State private var details: String = ""
    @State private var selectedProjectId: String = ""
    @State private var status: String = "Active"
    @State private var priority: String = "Medium"
    @State private var isSaving = false

    @StateObject private var projectsStore = ProjectsStore()
    @StateObject private var tasksStore = TasksStore()
    @StateObject private var initiativesStore = InitiativesStore()
    @StateObject private var personalStore = PersonalTasksStore()

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private let projectStatuses = ["Active", "Planning", "Paused", "Completed", "Canceled"]
    private let taskStatuses = ["Open", "In Progress", "Blocked", "Done"]
    private let initiativeStatuses = ["Open", "In Progress", "Done", "Planning"]
    private let priorities = ["Low", "Medium", "High", "Urgent"]

    init(
        tenantId: String,
        projects: [Project],
        defaultProjectId: String? = nil,
        initialType: QuickCreateType = .project,
        permissions: PermissionContext,
        onCreated: (() -> Void)? = nil
    ) {
        self.tenantId = tenantId
        self.projects = projects
        self.defaultProjectId = defaultProjectId
        self.initialType = initialType
        self.permissions = permissions
        self.onCreated = onCreated
        _type = State(initialValue: initialType)
        _selectedProjectId = State(initialValue: defaultProjectId ?? projects.first?.id ?? "")
    }

    private var selectableProjects: [Project] {
        projects.filter { !ProjectStatus.isCompleted($0.status) && !ProjectStatus.isCanceled($0.status) }
    }

    private var canSave: Bool {
        guard !title.trimmingCharacters(in: .whitespaces).isEmpty else { return false }
        if type.needsProject { return !selectedProjectId.isEmpty }
        return true
    }

    private var missingProject: Bool {
        type.needsProject && selectableProjects.isEmpty
    }

    var body: some View {
        PFSheetScaffold(
            title: L10n.tr("quickCreate.title", fallback: "New"),
            saveTitle: L10n.tr("common.create", fallback: "Create"),
            canSave: canSave && !missingProject,
            isSaving: isSaving,
            onCancel: { dismiss() },
            onSave: { Task { await save() } }
        ) {
            PFSegmentedControl(
                segments: QuickCreateType.allCases.map {
                    .init(id: $0.rawValue, title: $0.title, icon: $0.icon)
                },
                selection: Binding(
                    get: { type.rawValue },
                    set: { newValue in
                        if let next = QuickCreateType(rawValue: newValue) {
                            withAnimation { type = next }
                            resetDefaultsForType()
                        }
                    }
                )
            )

            if missingProject {
                PFEmptyState(
                    icon: "square.stack.3d.up.slash",
                    title: L10n.tr("quickCreate.noProject", fallback: "Create a project first."),
                    actionTitle: L10n.tr("quickCreate.type.project", fallback: "Project"),
                    action: { withAnimation { type = .project } }
                )
            } else {
                fields
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    private var fields: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            VStack(alignment: .leading, spacing: PFSpacing.xs + 2) {
                PFFieldLabel(text: L10n.tr("quickCreate.titlePlaceholder", fallback: "Title"))
                PFTextField(
                    placeholder: L10n.tr("quickCreate.titlePlaceholder", fallback: "Title"),
                    text: $title
                )
            }

            VStack(alignment: .leading, spacing: PFSpacing.xs + 2) {
                PFFieldLabel(text: L10n.tr("quickCreate.descriptionPlaceholder", fallback: "Description"))
                PFTextField(
                    placeholder: L10n.tr("quickCreate.descriptionPlaceholder", fallback: "Description (optional)"),
                    text: $details,
                    axis: .vertical
                )
            }

            if type.needsProject {
                VStack(alignment: .leading, spacing: PFSpacing.xs + 2) {
                    PFFieldLabel(text: L10n.tr("quickCreate.project", fallback: "Project"))
                    projectPicker
                }
            }

            if type != .personal {
                VStack(alignment: .leading, spacing: PFSpacing.xs + 2) {
                    PFFieldLabel(text: L10n.tr("quickCreate.status", fallback: "Status"))
                    PFChoiceChips(
                        options: statusOptions,
                        selection: $status,
                        tintProvider: { PFSemantic.statusTint($0, colors: colors) }
                    )
                }
            }

            if type == .task || type == .initiative || type == .personal {
                VStack(alignment: .leading, spacing: PFSpacing.xs + 2) {
                    PFFieldLabel(text: L10n.tr("quickCreate.priority", fallback: "Priority"))
                    PFChoiceChips(
                        options: priorities,
                        selection: $priority,
                        tintProvider: { PFSemantic.priorityTint($0, colors: colors) }
                    )
                }
            }
        }
    }

    private var projectPicker: some View {
        Menu {
            ForEach(selectableProjects) { project in
                Button(project.title) { selectedProjectId = project.id }
            }
        } label: {
            HStack {
                Text(selectedProjectTitle)
                    .font(PFFont.body)
                    .foregroundStyle(selectedProjectId.isEmpty ? colors.textMuted : colors.textMain)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.textMuted)
            }
            .padding(PFSpacing.sm + 2)
            .background(colors.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                    .stroke(colors.surfaceBorder, lineWidth: 1)
            )
        }
    }

    private var selectedProjectTitle: String {
        projects.first(where: { $0.id == selectedProjectId })?.title
            ?? L10n.tr("quickCreate.project.select", fallback: "Select project")
    }

    private var statusOptions: [String] {
        switch type {
        case .project: return projectStatuses
        case .task: return taskStatuses
        case .initiative: return initiativeStatuses
        case .personal: return []
        }
    }

    private func resetDefaultsForType() {
        switch type {
        case .project: status = "Active"
        case .task: status = "Open"
        case .initiative: status = "Open"
        case .personal: status = "Open"
        }
    }

    private func save() async {
        guard canSave else { return }
        isSaving = true
        defer { isSaving = false }

        let trimmedTitle = title.trimmingCharacters(in: .whitespaces)
        let trimmedDetails = details.trimmingCharacters(in: .whitespaces)

        switch type {
        case .project:
            await projectsStore.createProject(
                tenantId: tenantId,
                title: trimmedTitle,
                description: trimmedDetails,
                status: status,
                permissions: permissions
            )

        case .task:
            await tasksStore.createTask(
                tenantId: tenantId,
                projectId: selectedProjectId,
                title: trimmedTitle,
                description: trimmedDetails,
                status: status,
                priority: priority,
                permissions: permissions
            )

        case .initiative:
            var initiative = Initiative(id: "", data: [:])
            initiative.projectId = selectedProjectId
            initiative.tenantId = tenantId
            initiative.title = trimmedTitle
            initiative.description = trimmedDetails
            initiative.status = status
            initiative.priority = priority
            _ = try? await initiativesStore.create(
                tenantId: tenantId,
                projectId: selectedProjectId,
                initiative: initiative,
                permissions: permissions
            )

        case .personal:
            var personal = PersonalTask(id: "", data: [:])
            personal.title = trimmedTitle
            personal.description = trimmedDetails
            personal.priority = priority
            personal.tenantId = tenantId
            _ = try? await personalStore.create(tenantId: tenantId, task: personal)
        }

        onCreated?()
        dismiss()
    }
}
