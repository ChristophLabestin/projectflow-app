import SwiftUI

struct ProjectsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var store = ProjectsStore()
    @StateObject private var tenantStore = TenantStore()
    @State private var showingEditor = false
    @State private var editingProject: Project?
    @State private var draftTitle = ""
    @State private var draftDescription = ""
    @State private var draftStatus = "Active"
    @State private var deletingProject: Project?
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpacing.lg) {
                HStack {
                    Text("Projects")
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
                    .disabled(tenantStore.isLoading || tenantStore.activeTenantId == nil)
                }

                if tenantStore.isLoading || store.isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                }

                if let error = store.errorMessage {
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(colors.error)
                }

                if store.projects.isEmpty && !store.isLoading {
                    PFCard {
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text("No projects yet.")
                                .font(.headline)
                                .foregroundStyle(colors.textMain)
                            Text("Create a project to start tracking tasks, flows, and issues.")
                                .font(.subheadline)
                                .foregroundStyle(colors.textMuted)
                        }
                    }
                } else {
                    VStack(spacing: PFSpacing.md) {
                        ForEach(store.projects) { project in
                            projectRow(project)
                        }
                    }
                }
            }
                }
                .padding(PFSpacing.lg)
            }
            .background(colors.surfaceBg.ignoresSafeArea())
        }
        .onAppear {
            tenantStore.update(for: session.user)
        }
        .onChange(of: session.user) { _, user in
            tenantStore.update(for: user)
        }
        .onChange(of: tenantStore.activeTenantId) { _, tenantId in
            if let tenantId {
                store.start(tenantId: tenantId)
            } else {
                store.stop()
            }
        }
        .onDisappear {
            store.stop()
            tenantStore.stop()
        }
        .sheet(isPresented: $showingEditor) {
            ProjectEditorView(
                isEditing: editingProject != nil,
                title: $draftTitle,
                description: $draftDescription,
                status: $draftStatus
            ) {
                await saveProject()
            } onCancel: {
                showingEditor = false
            }
        }
        .confirmationDialog(
            "Delete Project?",
            isPresented: Binding(
                get: { deletingProject != nil },
                set: { if !$0 { deletingProject = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                guard let project = deletingProject else { return }
                Task {
                    await deleteProject(project)
                    deletingProject = nil
                }
            }
            Button("Cancel", role: .cancel) {
                deletingProject = nil
            }
        } message: {
            Text("This will permanently remove the project and its data.")
        }
    }

    private func projectRow(_ project: Project) -> some View {
        PFCard {
            HStack(alignment: .top, spacing: PFSpacing.md) {
                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    Text(project.title)
                        .font(.headline)
                        .foregroundStyle(colors.textMain)

                    Text(project.description.isEmpty ? "No description yet." : project.description)
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                        .lineLimit(2)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: PFSpacing.xs) {
                    Text(project.status)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(colors.textMain)

                    NavigationLink {
                        ProjectOverviewView(project: project, tenantId: tenantStore.activeTenantId)
                    } label: {
                        Image(systemName: "chevron.right")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(colors.textMuted)
                            .padding(6)
                            .background(colors.surfacePaper)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)

                    Menu {
                        Button("Edit") {
                            beginEdit(project)
                        }

                        Button("Delete", role: .destructive) {
                            deletingProject = project
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                            .foregroundStyle(colors.textMuted)
                            .padding(6)
                            .background(colors.surfacePaper)
                            .clipShape(Circle())
                    }
                }
            }
        }
    }

    private func beginCreate() {
        editingProject = nil
        draftTitle = ""
        draftDescription = ""
        draftStatus = "Active"
        showingEditor = true
    }

    private func beginEdit(_ project: Project) {
        editingProject = project
        draftTitle = project.title
        draftDescription = project.description
        draftStatus = project.status
        showingEditor = true
    }

    private func saveProject() async {
        guard let tenantId = tenantStore.activeTenantId else { return }
        let permissions = tenantStore.permissionContext(projectOwnerId: editingProject?.ownerId)

        if let project = editingProject {
            await store.updateProject(
                tenantId: tenantId,
                projectId: project.id,
                title: draftTitle,
                description: draftDescription,
                status: draftStatus,
                permissions: permissions
            )
        } else {
            await store.createProject(
                tenantId: tenantId,
                title: draftTitle,
                description: draftDescription,
                status: draftStatus,
                permissions: permissions
            )
        }

        if store.errorMessage == nil {
            showingEditor = false
        }
    }

    private func deleteProject(_ project: Project) async {
        guard let tenantId = tenantStore.activeTenantId else { return }
        let permissions = tenantStore.permissionContext(projectOwnerId: project.ownerId)
        await store.deleteProject(tenantId: tenantId, projectId: project.id, permissions: permissions)
    }
}

private struct ProjectEditorView: View {
    @Environment(\.colorScheme) private var colorScheme
    let isEditing: Bool
    @Binding var title: String
    @Binding var description: String
    @Binding var status: String
    let onSave: () async -> Void
    let onCancel: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let statuses = ["Active", "In Progress", "On Hold", "Completed"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                Text(isEditing ? "Edit Project" : "New Project")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(colors.textMain)

                PFInputField(
                    title: "Title",
                    placeholder: "Project name",
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

                PFPrimaryButton(title: isEditing ? "Save Changes" : "Create Project") {
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
