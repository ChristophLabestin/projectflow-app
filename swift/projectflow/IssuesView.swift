import SwiftUI

struct IssuesView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var tenantStore = TenantStore()
    @StateObject private var projectsStore = ProjectsStore()
    @StateObject private var issuesStore = IssuesStore()
    @StateObject private var pinnedTasksStore = PinnedTasksStore()
    @State private var selectedProjectId: String?
    @State private var showingEditor = false
    @State private var editingIssue: Issue?
    @State private var draftTitle = ""
    @State private var draftDescription = ""
    @State private var draftStatus = "Open"
    @State private var draftPriority = "Medium"
    @State private var deletingIssue: Issue?

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var selectedProject: Project? {
        projectsStore.projects.first { $0.id == selectedProjectId }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                HStack {
                    Text("Issues")
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
                    .disabled(selectedProjectId == nil || issuesStore.isLoading)
                }

                projectPicker

                if issuesStore.isLoading || tenantStore.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                }

                if let error = issuesStore.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(colors.error)
                }

                if let project = selectedProject, issuesStore.issues.isEmpty && !issuesStore.isLoading {
                    PFCard {
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text("No issues in \(project.title) yet.")
                                .font(.headline)
                                .foregroundStyle(colors.textMain)
                            Text("Capture issues so the team can resolve them quickly.")
                                .font(.subheadline)
                                .foregroundStyle(colors.textMuted)
                        }
                    }
                } else {
                    VStack(spacing: PFSpacing.md) {
                        ForEach(issuesStore.issues) { issue in
                            issueRow(issue)
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
                issuesStore.stop()
                return
            }
            issuesStore.start(tenantId: tenantId, projectId: projectId)
        }
        .onDisappear {
            issuesStore.stop()
            projectsStore.stop()
            tenantStore.stop()
            pinnedTasksStore.stop()
        }
        .sheet(isPresented: $showingEditor) {
            IssueEditorView(
                isEditing: editingIssue != nil,
                title: $draftTitle,
                description: $draftDescription,
                status: $draftStatus,
                priority: $draftPriority
            ) {
                await saveIssue()
            } onCancel: {
                showingEditor = false
            }
        }
        .confirmationDialog(
            "Delete Issue?",
            isPresented: Binding(
                get: { deletingIssue != nil },
                set: { if !$0 { deletingIssue = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                guard let issue = deletingIssue else { return }
                Task {
                    await deleteIssue(issue)
                    deletingIssue = nil
                }
            }
            Button("Cancel", role: .cancel) {
                deletingIssue = nil
            }
        } message: {
            Text("This will permanently remove the issue.")
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

    private func issueRow(_ issue: Issue) -> some View {
        PFCard {
            HStack(alignment: .top, spacing: PFSpacing.md) {
                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    Text(issue.title)
                        .font(.headline)
                        .foregroundStyle(colors.textMain)

                    if !issue.description.isEmpty {
                        Text(issue.description)
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                            .lineLimit(2)
                    }

                    Text("\(issue.status) • \(issue.priority) priority")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                }

                Spacer()

                Menu {
                    Button("Edit") {
                        beginEdit(issue)
                    }

                    Button("Delete", role: .destructive) {
                        deletingIssue = issue
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .foregroundStyle(colors.textMuted)
                        .padding(6)
                        .background(colors.surfacePaper)
                        .clipShape(Circle())
                }

                Button {
                    togglePin(issue)
                } label: {
                    Image(systemName: pinnedTasksStore.isPinned(issue.id) ? "pin.fill" : "pin")
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
        editingIssue = nil
        draftTitle = ""
        draftDescription = ""
        draftStatus = "Open"
        draftPriority = "Medium"
        showingEditor = true
    }

    private func beginEdit(_ issue: Issue) {
        editingIssue = issue
        draftTitle = issue.title
        draftDescription = issue.description
        draftStatus = issue.status
        draftPriority = issue.priority
        showingEditor = true
    }

    private func saveIssue() async {
        guard let tenantId = tenantStore.activeTenantId, let projectId = selectedProjectId else { return }
        let permissions = tenantStore.permissionContext(projectOwnerId: selectedProject?.ownerId)

        if let issue = editingIssue {
            await issuesStore.updateIssue(
                tenantId: tenantId,
                projectId: projectId,
                issueId: issue.id,
                title: draftTitle,
                description: draftDescription,
                status: draftStatus,
                priority: draftPriority,
                permissions: permissions
            )
        } else {
            await issuesStore.createIssue(
                tenantId: tenantId,
                projectId: projectId,
                title: draftTitle,
                description: draftDescription,
                status: draftStatus,
                priority: draftPriority,
                permissions: permissions
            )
        }

        if issuesStore.errorMessage == nil {
            showingEditor = false
        }
    }

    private func deleteIssue(_ issue: Issue) async {
        guard let tenantId = tenantStore.activeTenantId, let projectId = selectedProjectId else { return }
        let permissions = tenantStore.permissionContext(projectOwnerId: selectedProject?.ownerId)
        await issuesStore.deleteIssue(
            tenantId: tenantId,
            projectId: projectId,
            issueId: issue.id,
            permissions: permissions
        )
    }

    private func togglePin(_ issue: Issue) {
        guard let tenantId = tenantStore.activeTenantId else { return }
        if pinnedTasksStore.isPinned(issue.id) {
            pinnedTasksStore.unpin(itemId: issue.id)
        } else {
            let pinned = PinnedItem(
                id: issue.id,
                type: "issue",
                title: issue.title,
                projectId: issue.projectId ?? "",
                tenantId: tenantId,
                priority: issue.priority,
                isCompleted: issue.status == "Resolved" || issue.status == "Closed"
            )
            pinnedTasksStore.pin(item: pinned)
        }
    }
}

private struct IssueEditorView: View {
    @Environment(\.colorScheme) private var colorScheme
    let isEditing: Bool
    @Binding var title: String
    @Binding var description: String
    @Binding var status: String
    @Binding var priority: String
    let onSave: () async -> Void
    let onCancel: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let statuses = ["Open", "In Progress", "Resolved", "Closed"]
    private let priorities = ["Low", "Medium", "High", "Urgent"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                Text(isEditing ? "Edit Issue" : "New Issue")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(colors.textMain)

                PFInputField(
                    title: "Title",
                    placeholder: "Issue title",
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

                PFPrimaryButton(title: isEditing ? "Save Changes" : "Create Issue") {
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
