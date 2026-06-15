import SwiftUI

// MARK: - ProjectsView — Companion V2
//
// A lean, glanceable project list: grouped by lifecycle, searchable, with fast
// create and lightweight edit/delete. The heavy spotlight / health / insights
// depth lives in the web app — the companion stays quick in / quick out.

struct ProjectsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appSession: AppSession
    @StateObject private var store = ProjectsStore()
    @StateObject private var tenantStore = TenantStore()

    @State private var searchText = ""
    @State private var showQuickCreate = false
    @State private var editingProject: Project?
    @State private var deletingProject: Project?

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var activeTenantId: String { appSession.activeTenantId ?? tenantStore.activeTenantId ?? "" }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                ScrollView(showsIndicators: false) {
                    content
                        .pfScreenPadding(vertical: PFSpacing.md)
                        .pfTabBarClearance()
                        .tabBarScrollShrink()
                }
            }
            .navigationTitle(L10n.tr("projects.title", fallback: "Projects"))
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showQuickCreate = true } label: {
                        Image(systemName: "plus").foregroundStyle(colors.textMain)
                    }
                    .disabled(activeTenantId.isEmpty)
                }
            }
            .searchable(text: $searchText, prompt: L10n.tr("projects.search", fallback: "Search projects"))
        }
        .sheet(isPresented: $showQuickCreate) {
            QuickCreateSheet(
                tenantId: activeTenantId,
                projects: store.projects,
                initialType: .project,
                permissions: tenantStore.permissionContext()
            )
        }
        .sheet(item: $editingProject) { project in
            CompanionProjectEditSheet(project: project) { title, description, status in
                await save(project: project, title: title, description: description, status: status)
            }
        }
        .confirmationDialog(
            L10n.tr("common.delete", fallback: "Delete"),
            isPresented: Binding(get: { deletingProject != nil }, set: { if !$0 { deletingProject = nil } }),
            titleVisibility: .visible
        ) {
            Button(L10n.tr("common.delete", fallback: "Delete"), role: .destructive) {
                if let project = deletingProject {
                    Task { await delete(project); deletingProject = nil }
                }
            }
            Button(L10n.tr("common.cancel", fallback: "Cancel"), role: .cancel) { deletingProject = nil }
        }
        .onAppear {
            tenantStore.update(for: session.user)
            startIfPossible()
        }
        .onChange(of: appSession.activeTenantId) { _, _ in
            tenantStore.update(for: session.user)
            startIfPossible()
        }
        .onDisappear { store.stop() }
    }

    @ViewBuilder
    private var content: some View {
        if store.isLoading && store.projects.isEmpty {
            VStack(spacing: PFSpacing.md) {
                ProgressView()
            }
            .frame(maxWidth: .infinity, minHeight: 240)
        } else if store.projects.isEmpty {
            PFEmptyState(
                icon: "square.stack.3d.up",
                title: L10n.tr("projects.empty", fallback: "No projects yet"),
                message: L10n.tr("projects.empty.message", fallback: "Create your first project to get started."),
                actionTitle: activeTenantId.isEmpty ? nil : L10n.tr("projects.new", fallback: "New project"),
                action: activeTenantId.isEmpty ? nil : { showQuickCreate = true }
            )
            .padding(.top, PFSpacing.xl)
        } else if !searchText.isEmpty {
            searchResults
        } else {
            groupedSections
        }
    }

    private var searchResults: some View {
        let results = store.projects.filter {
            $0.title.localizedCaseInsensitiveContains(searchText) ||
            $0.description.localizedCaseInsensitiveContains(searchText)
        }
        return VStack(alignment: .leading, spacing: PFSpacing.md) {
            if results.isEmpty {
                PFEmptyState(icon: "magnifyingglass", title: L10n.tr("projects.empty", fallback: "No matches"))
            } else {
                projectCards(results)
            }
        }
    }

    private var groupedSections: some View {
        VStack(alignment: .leading, spacing: PFSpacing.lg) {
            group(L10n.tr("projects.company", fallback: "Company Projects"), companyProjects)
            group(L10n.tr("projects.active", fallback: "Active Projects"), activeProjects)
            group(L10n.tr("projects.planning", fallback: "Planning & Backlog"), planningProjects)
            group(L10n.tr("projects.paused", fallback: "Paused"), pausedProjects)
            group(L10n.tr("projects.completed", fallback: "Completed"), completedProjects)
            group(L10n.tr("projects.canceled", fallback: "Canceled"), canceledProjects)
        }
    }

    @ViewBuilder
    private func group(_ title: String, _ projects: [Project]) -> some View {
        if !projects.isEmpty {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionTitle(title: title, subtitle: String(format: L10n.tr("projects.count", fallback: "%d projects"), projects.count))
                projectCards(projects)
            }
        }
    }

    @ViewBuilder
    private func projectCards(_ projects: [Project]) -> some View {
        VStack(spacing: PFSpacing.sm) {
            ForEach(projects) { project in
                NavigationLink {
                    destination(for: project)
                } label: {
                    CompanionProjectCard(
                        project: project,
                        onEdit: { editingProject = project },
                        onDelete: { deletingProject = project }
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private func destination(for project: Project) -> some View {
        if project.isCompanyProject {
            CompanySectionView(companyProject: project, tenantId: tenantId(for: project))
        } else {
            ProjectOverviewView(project: project, tenantId: tenantId(for: project))
        }
    }

    // MARK: Grouping

    private var companyProjects: [Project] { store.projects.filter { $0.isCompanyProject } }
    private var activeProjects: [Project] {
        store.projects.filter { ProjectStatus.isActive($0.status) && !$0.isCompanyProject }
    }
    private var planningProjects: [Project] {
        store.projects.filter { ProjectStatus.isPlanning($0.status) && !$0.isCompanyProject }
    }
    private var pausedProjects: [Project] {
        store.projects.filter { ProjectStatus.isPaused($0.status) && !$0.isCompanyProject }
    }
    private var completedProjects: [Project] {
        store.projects.filter { ProjectStatus.isCompleted($0.status) && !$0.isCompanyProject }
    }
    private var canceledProjects: [Project] {
        store.projects.filter { ProjectStatus.isCanceled($0.status) && !$0.isCompanyProject }
    }

    // MARK: Actions

    private func startIfPossible() {
        if !activeTenantId.isEmpty { store.start(tenantId: activeTenantId) } else { store.stop() }
    }

    private func tenantId(for project: Project) -> String {
        project.tenantId ?? activeTenantId
    }

    private func save(project: Project, title: String, description: String, status: String) async {
        let permissions = tenantStore.permissionContext(projectOwnerId: project.ownerId)
        await store.updateProject(
            tenantId: tenantId(for: project),
            projectId: project.id,
            title: title,
            description: description,
            status: status,
            permissions: permissions
        )
    }

    private func delete(_ project: Project) async {
        let permissions = tenantStore.permissionContext(projectOwnerId: project.ownerId)
        await store.deleteProject(tenantId: tenantId(for: project), projectId: project.id, permissions: permissions)
    }
}

// MARK: - Project card

private struct CompanionProjectCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let project: Project
    let onEdit: () -> Void
    let onDelete: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                HStack(alignment: .top, spacing: PFSpacing.md) {
                    ZStack {
                        RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                            .fill(colors.primary.opacity(colorScheme == .dark ? 0.18 : 0.08))
                        if project.isCompanyProject {
                            Image(systemName: "building.2")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(colors.primary)
                        } else {
                            Text(String(project.title.prefix(1)).uppercased())
                                .font(.headline.weight(.bold))
                                .foregroundStyle(colors.primary)
                        }
                    }
                    .frame(width: 44, height: 44)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(project.title)
                            .font(PFFont.rowTitle)
                            .foregroundStyle(colors.textMain)
                            .lineLimit(1)
                        if !project.description.isEmpty {
                            Text(project.description)
                                .font(PFFont.detail)
                                .foregroundStyle(colors.textMuted)
                                .lineLimit(1)
                        }
                    }

                    Spacer(minLength: 0)

                    Menu {
                        Button(L10n.tr("common.edit", fallback: "Edit")) { onEdit() }
                        Button(L10n.tr("common.delete", fallback: "Delete"), role: .destructive) { onDelete() }
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(colors.textMuted)
                            .frame(width: 28, height: 28)
                            .background(colors.surfaceHover)
                            .clipShape(Circle())
                    }
                }

                HStack(spacing: PFSpacing.sm) {
                    PFStatusChip(status: project.status)
                    if !project.priority.isEmpty {
                        PFPriorityChip(priority: project.priority)
                    }
                    Spacer(minLength: 0)
                    Text("\(Int(project.progress))%")
                        .font(PFFont.chip)
                        .foregroundStyle(colors.textMain)
                }

                PFProgressBar(value: project.progress / 100, tint: PFSemantic.statusTint(project.status, colors: colors))
            }
        }
    }
}

// MARK: - Edit sheet

private struct CompanionProjectEditSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    let project: Project
    let onSave: (String, String, String) async -> Void

    @State private var title: String
    @State private var description: String
    @State private var status: String
    @State private var isSaving = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let statuses = ["Active", "Planning", "Paused", "Completed", "Canceled"]

    init(project: Project, onSave: @escaping (String, String, String) async -> Void) {
        self.project = project
        self.onSave = onSave
        _title = State(initialValue: project.title)
        _description = State(initialValue: project.description)
        _status = State(initialValue: project.status)
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
                    await onSave(title.trimmingCharacters(in: .whitespaces), description.trimmingCharacters(in: .whitespaces), status)
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
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
