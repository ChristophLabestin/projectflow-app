import SwiftUI
import FirebaseCore
import FirebaseFirestore
import FirebaseAuth
import FirebaseStorage

struct ProjectsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var store = ProjectsStore()
    @StateObject private var tenantStore = TenantStore()
    @StateObject private var pinnedProjectStore = PinnedProjectStore()
    @StateObject private var insightsStore = ProjectInsightsStore()
    @StateObject private var focusStore = FocusProjectStore()
    @StateObject private var teamStore = ProjectTeamStore()
    @StateObject private var mediaStore = ProjectMediaStore()
    @State private var showingEditor = false
    @State private var editingProject: Project?
    @State private var healthDetailContext: HealthDetailContext?
    @State private var quickEditContext: QuickEditContext?
    @State private var draftTitle = ""
    @State private var draftDescription = ""
    @State private var draftStatus = "Active"
    @State private var deletingProject: Project?
    @State private var searchText = ""
    @State private var sortOption: ProjectSortOption = .title
    @State private var filterStatus: Set<String> = []
    @State private var filterPriority: Set<String> = []
    @State private var filterOwner: Set<String> = []
    @State private var showFilters = false
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        let base = AnyView(
            NavigationStack {
                ZStack {
                    AppBackground()
                    ScrollView(.vertical, showsIndicators: false) {
                        content
                    }
                }
                .navigationTitle("Projects")
                .toolbar { projectsToolbar }
                .searchable(text: $searchText, prompt: "Search projects...")
            }
        )
        let withAppear = AnyView(base.onAppear {
            tenantStore.update(for: session.user)
            if let tenantId = tenantStore.activeTenantId {
                startStores(tenantId: tenantId)
            }
        })
        let withSessionChange = AnyView(withAppear.onChange(of: session.user) { _, user in
            tenantStore.update(for: user)
        })
        let withTenantChange = AnyView(withSessionChange.onChange(of: tenantStore.activeTenantId) { _, tenantId in
            if let tenantId {
                startStores(tenantId: tenantId)
            } else {
                stopStores()
            }
        })
        let withDisappear = AnyView(withTenantChange.onDisappear {
            stopStores()
        })
        let withSheet = AnyView(withDisappear.sheet(isPresented: $showingEditor) {
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
        })
        let withDialog = AnyView(withSheet.confirmationDialog(
            "Delete Project?",
            isPresented: Binding(
                get: { deletingProject != nil },
                set: { if !$0 { deletingProject = nil } }
            ),
            titleVisibility: SwiftUI.Visibility.visible
        ) {
            Button("Delete", role: .destructive) {
                guard let project = deletingProject else { return }
                _Concurrency.Task {
                    await deleteProject(project)
                    deletingProject = nil
                }
            }
            Button("Cancel", role: .cancel) {
                deletingProject = nil
            }
        } message: {
            Text("This will permanently remove the project and its data.")
        })
        let withFilterSheet = AnyView(withDialog.sheet(isPresented: $showFilters) {
            ProjectFilterSheet(
                sortOption: $sortOption,
                filterStatus: $filterStatus,
                filterPriority: $filterPriority,
                filterOwner: $filterOwner,
                projects: store.projects,
                ownerProfiles: teamStore.profilesById,
                currentUserId: session.user?.uid
            )
        })
        let withHealthSheet = AnyView(withFilterSheet.sheet(item: $healthDetailContext) { context in
            HealthDetailSheet(context: context)
        })
        let withQuickEdit = AnyView(withHealthSheet.sheet(item: $quickEditContext) { context in
            ProjectQuickEditSheet(
                project: context.project,
                onSave: { updates in
                    await applyQuickUpdates(project: context.project, updates: updates)
                },
                onCancel: {
                    quickEditContext = nil
                }
            )
        })

        return withQuickEdit
    }

    @ToolbarContentBuilder
    private var projectsToolbar: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button {
                teamStore.ensureProfiles(for: ownerIds)
                showFilters = true
            } label: {
                Image(systemName: isFiltering ? "line.3.horizontal.decrease.circle.fill" : "line.3.horizontal.decrease.circle")
                    .foregroundStyle(isFiltering ? colors.primary : colors.textMain)
            }
        }

        ToolbarItem(placement: .topBarTrailing) {
            Menu {
                if let spotlightProject {
                    Button("Focus Spotlight") {
                        toggleFocus(for: spotlightProject)
                    }
                }

                if focusStore.focusProjectId != nil {
                    Button("Clear Team Focus") {
                        clearFocus()
                    }
                }
            } label: {
                Image(systemName: "viewfinder")
                    .foregroundStyle(colors.textMain)
            }
            .disabled(tenantStore.activeTenantId == nil || focusStore.isLoading)
        }

        ToolbarItem(placement: .topBarTrailing) {
            Button {
                beginCreate()
            } label: {
                Image(systemName: "plus")
                    .foregroundStyle(colors.textMain)
            }
            .disabled(tenantStore.isLoading || tenantStore.activeTenantId == nil)
        }
    }

    private var content: some View {
        AnyView(
            VStack(alignment: .leading, spacing: PFSpacing.xl) {
                headerSection
                quickActionsSection
                loadingSection
                errorSection
                spotlightSection
                focusSection
                healthHighlightsSection
                listSection
            }
            .pfScreenPadding()
            .frame(maxWidth: .infinity, alignment: .leading)
        )
    }

    private var quickActionsSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(ProjectSortOption.allCases) { option in
                    FilterChip(
                        title: option.rawValue,
                        isSelected: sortOption == option,
                        onTap: { sortOption = option }
                    )
                }
                
                FilterChip(
                    title: "My Projects",
                    isSelected: !filterOwner.isEmpty,
                    onTap: {
                        if filterOwner.isEmpty {
                            if let uid = session.user?.uid {
                                filterOwner = [uid]
                            }
                        } else {
                            filterOwner.removeAll()
                        }
                    }
                )
            }
        }
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                Text("Workspace Portfolio")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(colors.textMain)

                Text("Spotlight priorities, watch health signals, and keep the team aligned.")
                    .font(.subheadline)
                    .foregroundStyle(colors.textMuted)
            }
            
            HStack(spacing: PFSpacing.md) {
                WorkspaceStatCard(
                    title: "Active Work",
                    value: "\(activeProjects.count)",
                    tint: colors.primary
                )
                
                WorkspaceStatCard(
                    title: "Critical Issues",
                    value: "\(criticalIssueCount)",
                    tint: colors.error
                )
                
                WorkspaceStatCard(
                    title: "Avg. Completion",
                    value: "\(Int(averageCompletion))%",
                    tint: colors.success
                )
            }
        }
    }
    
    private var criticalIssueCount: Int {
        // Approximate from store data (normally we'd need a more global fetch but let's sum project metrics)
        var total = 0
        for project in store.projects {
            total += insightsStore.metrics(for: project.id).openIssueCount
        }
        return total
    }
    
    private var averageCompletion: Double {
        guard !store.projects.isEmpty else { return 0 }
        let total = store.projects.reduce(0.0) { $0 + $1.progress }
        return total / Double(store.projects.count)
    }
    
private struct WorkspaceStatCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let value: String
    let tint: Color
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.title3.weight(.bold))
                .foregroundStyle(tint)
            Text(title)
                .font(.caption2.weight(.medium))
                .foregroundStyle(colors.textMuted)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(PFSpacing.sm)
        .background(colors.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md))
        .shadow(color: colors.shadowSm, radius: 2, x: 0, y: 1)
    }
}

    @ViewBuilder
    private var loadingSection: some View {
        if tenantStore.isLoading || store.isLoading || insightsStore.isLoading {
            PFCard {
                HStack(spacing: PFSpacing.sm) {
                    ProgressView()
                    Text("Syncing workspace data...")
                        .font(.footnote)
                        .foregroundStyle(colors.textMuted)
                }
            }
        }
    }

    @ViewBuilder
    private var errorSection: some View {
        if let error = store.errorMessage ?? insightsStore.errorMessage ?? focusStore.errorMessage ?? teamStore.errorMessage ?? mediaStore.errorMessage {
            PFCard {
                HStack(spacing: PFSpacing.sm) {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(colors.error)
                    Text(error)
                        .font(.footnote)
                        .foregroundStyle(colors.textMain)
                }
            }
        }
    }

    @ViewBuilder
    private var spotlightSection: some View {
        if let project = spotlightProject {
            let metrics = insightsStore.metrics(for: project.id)
            let health = insightsStore.health(for: project.id)
            let workload = insightsStore.workloadSummary(for: project.id)
            let activity = insightsStore.activity(for: project.id)
            let memberIds = resolvedMemberIds(for: project)
            let resources = projectResources(for: project)
            SpotlightHeroCard(
                mode: .spotlight,
                project: project,
                metrics: metrics,
                health: health,
                workload: workload,
                activity: activity,
                teamStore: teamStore,
                memberIds: memberIds,
                resources: resources,
                coverURL: mediaStore.coverURL(for: project.id),
                iconURL: mediaStore.iconURL(for: project.id),
                isFocused: focusStore.focusProjectId == project.id,
                isPinned: pinnedProjectStore.pinnedProjectId == project.id,
                onFocusToggle: { toggleFocus(for: project) },
                onPinToggle: { togglePinned(project) },
                onQuickEdit: { beginQuickEdit(project) },
                onHealthTap: {
                    showHealthDetail(
                        for: project,
                        health: health,
                        metrics: metrics,
                        workload: workload,
                        activity: activity
                    )
                },
                onEdit: { beginEdit(project) },
                onDelete: { deletingProject = project },
                destination: ProjectOverviewView(project: project, tenantId: resolvedTenantId(for: project))
            )
            .onAppear {
                if let tenantId = resolvedTenantId(for: project) {
                    mediaStore.fetchAssetsIfNeeded(projectId: project.id, tenantId: tenantId, project: project)
                }
            }
        }
    }

    @ViewBuilder
    private var focusSection: some View {
        if let project = focusProject, project.id != spotlightProject?.id {
            let metrics = insightsStore.metrics(for: project.id)
            let health = insightsStore.health(for: project.id)
            let workload = insightsStore.workloadSummary(for: project.id)
            let activity = insightsStore.activity(for: project.id)
            let memberIds = resolvedMemberIds(for: project)
            let resources = projectResources(for: project)
            SpotlightHeroCard(
                mode: .focus,
                project: project,
                metrics: metrics,
                health: health,
                workload: workload,
                activity: activity,
                teamStore: teamStore,
                memberIds: memberIds,
                resources: resources,
                coverURL: mediaStore.coverURL(for: project.id),
                iconURL: mediaStore.iconURL(for: project.id),
                isFocused: true,
                isPinned: pinnedProjectStore.pinnedProjectId == project.id,
                onFocusToggle: { toggleFocus(for: project) },
                onPinToggle: { togglePinned(project) },
                onQuickEdit: { beginQuickEdit(project) },
                onHealthTap: {
                    showHealthDetail(
                        for: project,
                        health: health,
                        metrics: metrics,
                        workload: workload,
                        activity: activity
                    )
                },
                onEdit: { beginEdit(project) },
                onDelete: { deletingProject = project },
                destination: ProjectOverviewView(project: project, tenantId: resolvedTenantId(for: project))
            )
            .onAppear {
                if let tenantId = resolvedTenantId(for: project) {
                    mediaStore.fetchAssetsIfNeeded(projectId: project.id, tenantId: tenantId, project: project)
                }
            }
        }
    }

    @ViewBuilder
    private var healthHighlightsSection: some View {
        if !store.projects.isEmpty {
            let summary = healthSummary
            let risks = topRiskProjects
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.sm) {
                    PFSectionHeader(title: "Health Highlights")

                    HStack(spacing: PFSpacing.sm) {
                        HealthStatChip(title: "Critical", value: summary.critical, color: colors.error)
                        HealthStatChip(title: "At Risk", value: summary.warning, color: colors.warning)
                        HealthStatChip(title: "Healthy", value: summary.healthy + summary.excellent, color: colors.success)
                    }

                    if risks.isEmpty {
                        Text("All projects are steady. Keep the momentum going.")
                            .font(.footnote)
                            .foregroundStyle(colors.textMuted)
                    } else {
                        VStack(alignment: .leading, spacing: PFSpacing.xs) {
                            ForEach(risks) { project in
                                let health = insightsStore.health(for: project.id)
                                HealthHighlightRow(
                                    title: project.title,
                                    score: health.score,
                                    status: health.status.label,
                                    color: healthColor(for: health.status)
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var listSection: some View {
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
        } else if isFiltering {
            if filteredProjects.isEmpty {
                PFCard {
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        Text("No matches found.")
                            .font(.headline)
                            .foregroundStyle(colors.textMain)
                        Text("Try adjusting your search or filters.")
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                    }
                }
            } else {
                VStack(alignment: .leading, spacing: PFSpacing.lg) {
                    ProjectGroupHeader(
                        title: "Filtered Results",
                        subtitle: "\(filteredProjects.count) projects match",
                        count: filteredProjects.count,
                        tint: colors.primary
                    )
                    projectCards(for: filteredProjects)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                ProjectGroupSection(
                    title: "Active Projects",
                    subtitle: "Work in motion and priorities in progress.",
                    tint: colors.primaryFade,
                    projects: activeProjects,
                    emptyTitle: "No active projects yet.",
                    emptyMessage: "Kick off a new initiative or move one out of planning.",
                    actionTitle: "Create Project",
                    onAction: { beginCreate() }
                ) { projectCards(for: activeProjects) }

                ProjectGroupSection(
                    title: "Planning & On Hold",
                    subtitle: "Paused or preparing for the next cycle.",
                    tint: colors.surfaceHover,
                    projects: planningProjects,
                    emptyTitle: "Nothing in planning right now.",
                    emptyMessage: "Move projects here when you're outlining the next wave.",
                    actionTitle: nil,
                    onAction: nil
                ) { projectCards(for: planningProjects) }

                ProjectGroupSection(
                    title: "Completed",
                    subtitle: "Recently finished initiatives.",
                    tint: colors.surfaceHover,
                    projects: completedProjects,
                    emptyTitle: "No completed projects yet.",
                    emptyMessage: "Completed work will show up here for celebration and review.",
                    actionTitle: nil,
                    onAction: nil
                ) { projectCards(for: completedProjects) }

                if !otherProjects.isEmpty {
                    ProjectGroupSection(
                        title: "Other Projects",
                        subtitle: nil,
                        tint: colors.surfaceHover,
                        projects: otherProjects,
                        emptyTitle: nil,
                        emptyMessage: nil,
                        actionTitle: nil,
                        onAction: nil
                    ) { projectCards(for: otherProjects) }
                }
            }
        }
    }

    private func startStores(tenantId: String) {
        store.start(tenantId: tenantId)
        pinnedProjectStore.start(tenantId: tenantId)
        insightsStore.start(tenantId: tenantId)
        focusStore.start(tenantId: tenantId)
        teamStore.start(tenantId: tenantId)
        mediaStore.start(tenantId: tenantId)
    }

    private func stopStores() {
        store.stop()
        tenantStore.stop()
        pinnedProjectStore.stop()
        insightsStore.stop()
        focusStore.stop()
        teamStore.stop()
        mediaStore.stop()
    }

    private var isFiltering: Bool {
        !searchText.isEmpty || sortOption != .title || !filterStatus.isEmpty || !filterPriority.isEmpty || !filterOwner.isEmpty
    }

    private var filteredProjects: [Project] {
        var result = store.projects

        if !searchText.isEmpty {
            result = result.filter {
                $0.title.localizedCaseInsensitiveContains(searchText) ||
                $0.description.localizedCaseInsensitiveContains(searchText)
            }
        }

        if !filterStatus.isEmpty {
            result = result.filter { filterStatus.contains($0.status) }
        }

        if !filterPriority.isEmpty {
            result = result.filter { filterPriority.contains($0.priority) }
        }

        if !filterOwner.isEmpty {
            result = result.filter { filterOwner.contains($0.ownerId) }
        }

        switch sortOption {
        case .title:
            result.sort { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        case .health:
            result.sort {
                insightsStore.health(for: $0.id).score > insightsStore.health(for: $1.id).score
            }
        case .dueDate:
            result.sort {
                let d1 = $0.dueDate
                let d2 = $1.dueDate
                if d1.isEmpty { return false }
                if d2.isEmpty { return true }
                return d1 < d2
            }
        case .activity:
            result.sort {
                let a1 = insightsStore.activity(for: $0.id).first?.createdAt?.dateValue() ?? Date.distantPast
                let a2 = insightsStore.activity(for: $1.id).first?.createdAt?.dateValue() ?? Date.distantPast
                return a1 > a2
            }
        }

        return result
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

    private func beginQuickEdit(_ project: Project) {
        quickEditContext = QuickEditContext(id: project.id, project: project)
    }

    private func saveProject() async {
        guard let tenantId = resolvedTenantId(for: editingProject) else { return }
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
        guard let tenantId = resolvedTenantId(for: project) else { return }
        let permissions = tenantStore.permissionContext(projectOwnerId: project.ownerId)
        await store.deleteProject(tenantId: tenantId, projectId: project.id, permissions: permissions)
    }

    private func applyQuickUpdates(project: Project, updates: [String: Any]) async {
        guard let tenantId = resolvedTenantId(for: project) else { return }
        let permissions = tenantStore.permissionContext(projectOwnerId: project.ownerId)
        await store.updateProjectFields(tenantId: tenantId, projectId: project.id, updates: updates, permissions: permissions)
    }

    private func resolvedTenantId(for project: Project? = nil) -> String? {
        project?.tenantId ?? tenantStore.activeTenantId
    }

    private var spotlightProject: Project? {
        if let spotlightId = insightsStore.spotlightProjectId,
           let project = store.projects.first(where: { $0.id == spotlightId }) {
            return project
        }
        if let pinnedId = pinnedProjectStore.pinnedProjectId,
           let project = store.projects.first(where: { $0.id == pinnedId }) {
            return project
        }
        return nil
    }

    private var focusProject: Project? {
        guard let focusId = focusStore.focusProjectId else { return nil }
        return store.projects.first { $0.id == focusId }
    }

    private var projectsForGrid: [Project] {
        let excluded = Set([spotlightProject?.id, focusProject?.id].compactMap { $0 })
        var filtered = store.projects.filter { !excluded.contains($0.id) }
        if let pinnedId = pinnedProjectStore.pinnedProjectId,
           let index = filtered.firstIndex(where: { $0.id == pinnedId }) {
            let pinned = filtered.remove(at: index)
            filtered.insert(pinned, at: 0)
        }
        return filtered
    }

    private var ownerIds: [String] {
        var unique: [String] = []
        for project in store.projects where !project.ownerId.isEmpty {
            if !unique.contains(project.ownerId) {
                unique.append(project.ownerId)
            }
        }
        return unique
    }

    private func resolvedMemberIds(for project: Project) -> [String] {
        var ids: [String] = []
        if !project.memberIds.isEmpty {
            ids = project.memberIds
        } else if !project.members.isEmpty {
            ids = project.members.map { $0.userId }
        } else if !project.ownerId.isEmpty {
            ids = [project.ownerId]
        }

        if !project.ownerId.isEmpty && !ids.contains(project.ownerId) {
            ids.append(project.ownerId)
        }

        var unique: [String] = []
        for id in ids where !id.isEmpty {
            if !unique.contains(id) {
                unique.append(id)
            }
        }
        return unique
    }

    private func projectResources(for project: Project) -> [ProjectLink] {
        let combined = project.links + project.externalResources
        return combined.filter { !$0.title.isEmpty && !$0.url.isEmpty }
    }

    private var activeProjects: [Project] {
        projectsForGrid.filter { isActiveStatus($0.status) }
    }

    private var planningProjects: [Project] {
        projectsForGrid.filter { isPlanningStatus($0.status) }
    }

    private var completedProjects: [Project] {
        projectsForGrid.filter { isCompletedStatus($0.status) }
    }

    private var otherProjects: [Project] {
        projectsForGrid.filter {
            !isActiveStatus($0.status) && !isPlanningStatus($0.status) && !isCompletedStatus($0.status)
        }
    }

    private func isActiveStatus(_ status: String) -> Bool {
        let key = status.lowercased()
        return key == "active" || key == "in progress" || key == "in-progress"
    }

    private func isPlanningStatus(_ status: String) -> Bool {
        let key = status.lowercased()
        return key == "on hold" || key == "on-hold" || key == "planning"
    }

    private func isCompletedStatus(_ status: String) -> Bool {
        status.lowercased() == "completed"
    }

    @ViewBuilder
    private func projectCards(for items: [Project]) -> some View {
        VStack(spacing: PFSpacing.md) {
            ForEach(items) { project in
                let metrics = insightsStore.metrics(for: project.id)
                let health = insightsStore.health(for: project.id)
                let workload = insightsStore.workloadSummary(for: project.id)
                let activity = insightsStore.activity(for: project.id)
                let memberIds = resolvedMemberIds(for: project)
                let resources = projectResources(for: project)

                ProjectListCard(
                    project: project,
                    metrics: metrics,
                    health: health,
                    workload: workload,
                    activity: activity,
                    teamStore: teamStore,
                    memberIds: memberIds,
                    resources: resources,
                    coverURL: mediaStore.coverURL(for: project.id),
                    iconURL: mediaStore.iconURL(for: project.id),
                    isPinned: pinnedProjectStore.pinnedProjectId == project.id,
                    isFocused: focusStore.focusProjectId == project.id,
                    onFocusToggle: { toggleFocus(for: project) },
                    onPinToggle: { togglePinned(project) },
                    onQuickEdit: { beginQuickEdit(project) },
                    onHealthTap: {
                        showHealthDetail(
                            for: project,
                            health: health,
                            metrics: metrics,
                            workload: workload,
                            activity: activity
                        )
                    },
                    onEdit: { beginEdit(project) },
                    onDelete: { deletingProject = project },
                    destination: ProjectOverviewView(project: project, tenantId: resolvedTenantId(for: project))
                )
                .onAppear {
                    if let tenantId = resolvedTenantId(for: project) {
                        mediaStore.fetchAssetsIfNeeded(projectId: project.id, tenantId: tenantId, project: project)
                    }
                }
            }
        }
    }


    private var healthSummary: HealthSummary {
        var summary = HealthSummary()
        for project in store.projects {
            let status = insightsStore.health(for: project.id).status
            switch status {
            case .critical:
                summary.critical += 1
            case .warning:
                summary.warning += 1
            case .healthy:
                summary.healthy += 1
            case .excellent:
                summary.excellent += 1
            case .normal:
                summary.normal += 1
            case .stalemate:
                summary.warning += 1
            }
        }
        return summary
    }

    private var topRiskProjects: [Project] {
        store.projects.sorted { left, right in
            insightsStore.health(for: left.id).score < insightsStore.health(for: right.id).score
        }.prefix(3).map { $0 }
    }

    private func healthColor(for status: HealthStatus) -> Color {
        switch status {
        case .critical:
            return colors.error
        case .warning:
            return colors.warning
        case .healthy, .excellent:
            return colors.success
        case .normal:
            return colors.primary
        case .stalemate:
            return colors.textSubtle
        }
    }

    private func togglePinned(_ project: Project) {
        guard let tenantId = resolvedTenantId(for: project) else { return }
        if pinnedProjectStore.pinnedProjectId == project.id {
            pinnedProjectStore.unpin(tenantId: tenantId)
        } else {
            pinnedProjectStore.pin(projectId: project.id, tenantId: tenantId)
        }
    }

    private func toggleFocus(for project: Project) {
        guard let tenantId = resolvedTenantId(for: project) else { return }
        let target = focusStore.focusProjectId == project.id ? nil : project.id
        _Concurrency.Task {
            await focusStore.setFocus(tenantId: tenantId, projectId: target)
        }
    }

    private func clearFocus() {
        guard let tenantId = resolvedTenantId() else { return }
        _Concurrency.Task {
            await focusStore.setFocus(tenantId: tenantId, projectId: nil)
        }
    }

    private func showHealthDetail(
        for project: Project,
        health: ProjectHealthSnapshot,
        metrics: ProjectMetrics,
        workload: ProjectWorkloadSummary,
        activity: [ActivityItem]
    ) {
        healthDetailContext = HealthDetailContext(
            id: project.id,
            project: project,
            health: health,
            metrics: metrics,
            workload: workload,
            activity: activity
        )
    }
}

private struct ProjectGroupHeader: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let subtitle: String?
    let count: Int
    let tint: Color

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            PFSectionHeader(title: title, subtitle: subtitle)
            Spacer()
            StatusPill(text: "\(count)", tint: tint, textColor: colors.textMain)
        }
    }
}

private struct ProjectGroupSection<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let subtitle: String?
    let tint: Color
    let projects: [Project]
    let emptyTitle: String?
    let emptyMessage: String?
    let actionTitle: String?
    let onAction: (() -> Void)?
    let content: () -> Content

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    init(
        title: String,
        subtitle: String?,
        tint: Color,
        projects: [Project],
        emptyTitle: String?,
        emptyMessage: String?,
        actionTitle: String?,
        onAction: (() -> Void)?,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.tint = tint
        self.projects = projects
        self.emptyTitle = emptyTitle
        self.emptyMessage = emptyMessage
        self.actionTitle = actionTitle
        self.onAction = onAction
        self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.md) {
            ProjectGroupHeader(
                title: title,
                subtitle: subtitle,
                count: projects.count,
                tint: projects.isEmpty ? colors.surfaceHover : tint
            )

            if projects.isEmpty {
                if let emptyTitle, let emptyMessage {
                    ProjectGroupEmptyCard(
                        title: emptyTitle,
                        message: emptyMessage,
                        actionTitle: actionTitle,
                        onAction: onAction
                    )
                }
            } else {
                content()
            }
        }
    }
}

private struct ProjectGroupEmptyCard: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let message: String
    let actionTitle: String?
    let onAction: (() -> Void)?

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(colors.textMain)
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(colors.textMuted)

                if let actionTitle, let onAction {
                    PFPrimaryButton(title: actionTitle) {
                        onAction()
                    }
                }
            }
        }
    }
}

private enum SpotlightMode: String {
    case spotlight = "Spotlight"
    case focus = "Team Focus"
}

private struct HealthSummary {
    var critical = 0
    var warning = 0
    var normal = 0
    var healthy = 0
    var excellent = 0
}

private struct SpotlightHeroCard<Destination: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    let mode: SpotlightMode
    let project: Project
    let metrics: ProjectMetrics
    let health: ProjectHealthSnapshot
    let workload: ProjectWorkloadSummary
    let activity: [ActivityItem]
    @ObservedObject var teamStore: ProjectTeamStore
    let memberIds: [String]
    let resources: [ProjectLink]
    let coverURL: URL?
    let iconURL: URL?
    let isFocused: Bool
    let isPinned: Bool
    let onFocusToggle: () -> Void
    let onPinToggle: () -> Void
    let onQuickEdit: () -> Void
    let onHealthTap: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    let destination: Destination

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var accent: Color {
        switch health.status {
        case .critical: return colors.error
        case .warning: return colors.warning
        case .healthy, .excellent: return colors.success
        case .normal: return colors.primary
        case .stalemate: return colors.textSubtle
        }
    }
    
    private func formatDateString(_ isoString: String) -> String {
        guard !isoString.isEmpty else { return "" }
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: isoString) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "MMM d"
            return displayFormatter.string(from: date)
        }
        // Fallback for simple format
        let simpleFormatter = DateFormatter()
        simpleFormatter.dateFormat = "yyyy-MM-dd"
        if let date = simpleFormatter.date(from: String(isoString.prefix(10))) {
            let displayFormatter = DateFormatter()
            displayFormatter.dateFormat = "MMM d"
            return displayFormatter.string(from: date)
        }
        return isoString.prefix(10).replacingOccurrences(of: "-", with: "/")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            // Mode Label
            Text(mode.rawValue.uppercased())
                .font(.caption.weight(.bold))
                .foregroundStyle(accent)
                .tracking(1)

            // Main Card
            VStack(alignment: .leading, spacing: 0) {
                // Cover Image (optional)
                if let coverURL {
                    GeometryReader { geo in
                        AsyncImage(url: coverURL) { phase in
                            switch phase {
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                                    .frame(width: geo.size.width, height: 140)
                            case .failure:
                                colors.surfaceHover
                                    .frame(width: geo.size.width, height: 140)
                            case .empty:
                                LinearGradient(
                                    colors: [colors.surfaceHover, colors.surfacePaper],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                                .frame(width: geo.size.width, height: 140)
                            @unknown default:
                                colors.surfaceHover
                                    .frame(width: geo.size.width, height: 140)
                            }
                        }
                    }
                    .frame(height: 140)
                    .clipped()
                }

                // Content
                VStack(alignment: .leading, spacing: PFSpacing.md) {
                    // --- Header Row ---
                    HStack(alignment: .top, spacing: PFSpacing.sm) {
                        ProjectAvatarView(iconURL: iconURL, title: project.title, colors: colors)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(project.title)
                                .font(.title3.weight(.bold))
                                .foregroundStyle(colors.textMain)
                                .lineLimit(1)

                            Text(project.description.isEmpty ? "No description" : project.description)
                                .font(.subheadline)
                                .foregroundStyle(colors.textMuted)
                                .lineLimit(2)
                        }

                        Spacer()

                        // Health Badge + Focus indicator
                        VStack(alignment: .trailing, spacing: 6) {
                            Button(action: onHealthTap) {
                                HStack(spacing: 6) {
                                    Text("\(health.score)")
                                        .font(.title2.weight(.bold))
                                        .foregroundStyle(accent)
                                    Text(health.status.label.uppercased())
                                        .font(.caption2.weight(.bold))
                                        .foregroundStyle(accent)
                                }
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(accent.opacity(0.15))
                                .clipShape(RoundedRectangle(cornerRadius: PFRadius.sm))
                            }
                            .buttonStyle(.plain)

                            if isFocused {
                                Text("Focused")
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(colors.primary)
                            }
                        }
                    }

                    // --- Quick Stats Row ---
                    HStack(spacing: PFSpacing.md) {
                        QuickStatItem(icon: "checkmark.circle", label: "Tasks", value: "\(metrics.openTaskCount) open", colors: colors)
                        QuickStatItem(icon: "exclamationmark.triangle", label: "Issues", value: "\(metrics.openIssueCount)", colors: colors)
                        
                        Spacer()
                        
                        // Team Avatars
                        ProjectTeamStrip(
                            teamStore: teamStore,
                            memberIds: memberIds,
                            maxVisible: 3
                        )
                    }

                    // --- Progress Section ---
                    VStack(spacing: 6) {
                        HStack {
                            if !project.startDate.isEmpty {
                                Text("START")
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(colors.textSubtle)
                                Text(formatDateString(project.startDate))
                                    .font(.caption2.weight(.medium))
                                    .foregroundStyle(colors.textMuted)
                            }
                            Spacer()
                            if !project.dueDate.isEmpty {
                                Text("DUE")
                                    .font(.caption2.weight(.semibold))
                                    .foregroundStyle(colors.textSubtle)
                                Text(formatDateString(project.dueDate))
                                    .font(.caption2.weight(.medium))
                                    .foregroundStyle(colors.textMuted)
                            }
                        }

                        // Progress Bar
                        GeometryReader { geo in
                            ZStack(alignment: .leading) {
                                Capsule()
                                    .fill(colors.surfaceHover)
                                    .frame(height: 6)
                                Capsule()
                                    .fill(accent)
                                    .frame(width: max(0, min(geo.size.width, geo.size.width * (project.progress / 100.0))), height: 6)
                            }
                        }
                        .frame(height: 6)

                        HStack {
                            Text(health.status.label)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(accent)
                            Spacer()
                            Text("\(Int(project.progress))%")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(colors.textMain)
                        }
                    }

                    Divider()
                        .overlay(colors.surfaceBorder)

                    // --- Action Row ---
                    HStack(spacing: PFSpacing.sm) {
                        NavigationLink(destination: destination) {
                            HStack(spacing: 4) {
                                Image(systemName: "arrow.up.right")
                                Text("Open Project")
                            }
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(colors.textMain)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(colors.surfaceHover)
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)

                        Button(action: onFocusToggle) {
                            HStack(spacing: 4) {
                                Image(systemName: "viewfinder")
                                Text(isFocused ? "Clear Focus" : "Focus")
                            }
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(colors.textMuted)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(colors.surfaceHover)
                            .clipShape(Capsule())
                        }
                        .buttonStyle(.plain)

                        Button(action: onPinToggle) {
                            Image(systemName: isPinned ? "pin.fill" : "pin")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(colors.textMuted)
                                .padding(8)
                                .background(colors.surfaceHover)
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)

                        Spacer()

                        Menu {
                            Button("Quick Edit") { onQuickEdit() }
                            Button("Edit Project") { onEdit() }
                            Button("Delete", role: .destructive) { onDelete() }
                        } label: {
                            Image(systemName: "ellipsis")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(colors.textMuted)
                                .padding(8)
                                .background(colors.surfaceHover)
                                .clipShape(Circle())
                        }
                    }
                }
                .padding(PFSpacing.md)
            }
            .background(colors.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
            .shadow(color: colors.shadowSm, radius: 8, x: 0, y: 4)
        }
    }
}

// Simple stat item for the SpotlightHeroCard
private struct QuickStatItem: View {
    let icon: String
    let label: String
    let value: String
    let colors: PFColors

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(colors.textMuted)
            VStack(alignment: .leading, spacing: 0) {
                Text(label.uppercased())
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(colors.textSubtle)
                Text(value)
                    .font(.caption.weight(.medium))
                    .foregroundStyle(colors.textMain)
            }
        }
    }
}

private struct ProjectListCard<Destination: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    let project: Project
    let metrics: ProjectMetrics
    let health: ProjectHealthSnapshot
    let workload: ProjectWorkloadSummary
    let activity: [ActivityItem]
    @ObservedObject var teamStore: ProjectTeamStore
    let memberIds: [String]
    let resources: [ProjectLink]
    let coverURL: URL?
    let iconURL: URL?
    let isPinned: Bool
    let isFocused: Bool
    let onFocusToggle: () -> Void
    let onPinToggle: () -> Void
    let onQuickEdit: () -> Void
    let onHealthTap: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    let destination: Destination

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var healthColor: Color {
        switch health.status {
        case .critical: return colors.error
        case .warning: return colors.warning
        case .healthy, .excellent: return colors.success
        case .normal: return colors.primary
        case .stalemate: return colors.textSubtle
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Edge-to-edge Cover Image
            if let coverURL {
                GeometryReader { geo in
                    AsyncImage(url: coverURL) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: geo.size.width, height: 140)
                        case .failure:
                            colors.surfaceHover
                                .frame(width: geo.size.width, height: 140)
                        case .empty:
                            LinearGradient(
                                colors: [colors.surfaceHover, colors.surfacePaper],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                            .frame(width: geo.size.width, height: 140)
                        @unknown default:
                            colors.surfaceHover
                                .frame(width: geo.size.width, height: 140)
                        }
                    }
                }
                .frame(height: 140)
                .clipped()
            }
            
            // Card Content with Padding
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                // --- Header: Title & Actions ---
                HStack(alignment: .top) {
                    ProjectAvatarView(iconURL: iconURL, title: project.title, colors: colors)

                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: PFSpacing.xs) {
                            Text(project.title)
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(colors.textMain)
                                .lineLimit(1)
                            
                            if isPinned {
                                Image(systemName: "pin.fill")
                                    .font(.caption2)
                                    .foregroundStyle(colors.primary)
                            }
                        }
                        
                        // Metadata Row: Status & Priority
                        HStack(spacing: PFSpacing.xs) {
                            StatusPill(text: project.status, tint: colors.surfaceHover)
                            if !project.priority.isEmpty {
                                Text("•")
                                    .foregroundStyle(colors.textMuted)
                                    .font(.caption2)
                                Text(project.priority)
                                    .font(.caption.weight(.medium))
                                    .foregroundStyle(colors.textMuted)
                            }
                        }
                    }
                    
                    Spacer()
                    
                    // Quick Menu
                    Menu {
                        Button(action: onFocusToggle) {
                            Label(isFocused ? "Unfocus" : "Focus", systemImage: "viewfinder")
                        }
                        Button(action: onPinToggle) {
                            Label(isPinned ? "Unpin" : "Pin", systemImage: isPinned ? "pin.fill" : "pin")
                        }
                        Button("Quick Edit") { onQuickEdit() }
                        Divider()
                        Button("Edit Project") { onEdit() }
                        Button("Delete", role: .destructive) { onDelete() }
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(colors.textMuted)
                            .frame(width: 24, height: 24)
                            .background(colors.surfaceHover)
                            .clipShape(Circle())
                    }
                }
                
                // --- Description ---
                if !project.description.isEmpty {
                    Text(project.description)
                        .font(.subheadline)
                        .foregroundStyle(colors.textSubtle)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                
                // --- Progress Bar ---
                VStack(spacing: 4) {
                    HStack {
                        Text("Progress")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(colors.textMuted)
                            .textCase(.uppercase)
                        Spacer()
                        Text("\(Int(project.progress))%")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(colors.textMain)
                    }
                    
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule()
                                .fill(colors.surfaceHover)
                                .frame(height: 4)
                            
                            Capsule()
                                .fill(healthColor)
                                .frame(width: max(0, min(geo.size.width, geo.size.width * (project.progress / 100.0))), height: 4)
                        }
                    }
                    .frame(height: 4)
                }
                
                Divider()
                    .overlay(colors.surfaceBorder)
                
                // --- Metrics Grid ---
                HStack(spacing: PFSpacing.lg) {
                    // Task Count
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                        Text("\(metrics.openTaskCount) open")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(colors.textMain)
                    }
                    
                    // Issue Count
                    if metrics.openIssueCount > 0 {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .font(.caption)
                                .foregroundStyle(colors.warning)
                            Text("\(metrics.openIssueCount) issues")
                                .font(.caption.weight(.medium))
                                .foregroundStyle(colors.textMain)
                        }
                    }
                    
                    Spacer()
                    
                    // Health Badge (Mini)
                    Button(action: onHealthTap) {
                        HStack(spacing: 4) {
                            Circle()
                                .fill(healthColor)
                                .frame(width: 8, height: 8)
                            Text(health.status.label)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(healthColor)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(healthColor.opacity(0.1))
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
                
                // --- Footer (Team & Link) ---
                HStack {
                     ProjectTeamStrip(
                        teamStore: teamStore,
                        memberIds: memberIds,
                        maxVisible: 3
                    )
                    
                    Spacer()
                    
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                }
                .padding(.top, PFSpacing.xs)
            }
            .padding(PFSpacing.md)
        }
        .background(colors.surfaceCard)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
        .shadow(
            color: isFocused ? colors.primary.opacity(0.15) : colors.shadowSm,
            radius: isFocused ? 12 : 4,
            x: 0,
            y: isFocused ? 4 : 2
        )
        .overlay(
            RoundedRectangle(cornerRadius: PFRadius.lg)
                .stroke(isFocused ? colors.primary.opacity(0.5) : Color.clear, lineWidth: 1)
        )
        .background(
            NavigationLink(destination: destination) {
                EmptyView()
            }
            .opacity(0)
        )
        .contentShape(RoundedRectangle(cornerRadius: PFRadius.lg, style: .continuous))
    }
}

private struct ProjectAvatarView: View {
    let iconURL: URL?
    let title: String
    let colors: PFColors

    private var initials: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let first = trimmed.first else { return "P" }
        return String(first).uppercased()
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(colors.surfaceHover)
                .frame(width: 44, height: 44)

            if let iconURL {
                AsyncImage(url: iconURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        Text(initials)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(colors.textMain)
                    case .empty:
                        ProgressView()
                    @unknown default:
                        Text(initials)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(colors.textMain)
                    }
                }
                .frame(width: 44, height: 44)
                .clipShape(Circle())
            } else {
                Text(initials)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(colors.textMain)
            }
        }
    }
}

private struct ProjectPlanningSummary: View {
    @Environment(\.colorScheme) private var colorScheme
    let project: Project
    let metrics: ProjectMetrics
    let accent: Color

    private enum DueStatus {
        case overdue
        case dueSoon
        case onTrack
    }

    private struct PriorityStyle {
        let tint: Color
        let textColor: Color
    }

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var progressPercent: Int {
        let base: Double
        if metrics.taskCount > 0 {
            base = (Double(metrics.taskCompleted) / Double(metrics.taskCount)) * 100
        } else {
            base = project.progress
        }
        return max(0, min(100, Int(round(base))))
    }
    private var startDate: Date? { parseDate(project.startDate) }
    private var dueDate: Date? { parseDate(project.dueDate) }
    private var priorityStyle: PriorityStyle? {
        let key = project.priority.lowercased()
        let tint: Color
        switch key {
        case "urgent":
            tint = colors.error
        case "high":
            tint = colors.warning
        case "medium":
            tint = colors.primary
        case "low":
            tint = colors.success
        default:
            return nil
        }
        return PriorityStyle(tint: tint.opacity(0.15), textColor: tint)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            HStack(spacing: PFSpacing.sm) {
                Text("Progress")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)

                Spacer()

                if let priorityStyle {
                    StatusPill(text: project.priority, tint: priorityStyle.tint, textColor: priorityStyle.textColor)
                }

                Text("\(progressPercent)%")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(accent)
            }

            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(colors.surfaceHover)

                    Capsule()
                        .fill(accent)
                        .frame(width: proxy.size.width * CGFloat(progressPercent) / 100.0)
                }
            }
            .frame(height: 6)

            HStack {
                ProjectDateStack(
                    label: "Start",
                    value: startDate.map(formattedDate) ?? "Not set",
                    valueColor: startDate == nil ? colors.textSubtle : colors.textMain
                )

                Spacer()

                ProjectDateStack(
                    label: "Due",
                    value: dueDate.map(formattedDate) ?? "Not set",
                    valueColor: dueDateTone
                )
            }
        }
    }

    private var dueDateTone: Color {
        guard let dueDate else { return colors.textSubtle }
        switch dueStatus(for: dueDate) {
        case .overdue:
            return colors.error
        case .dueSoon:
            return colors.warning
        case .onTrack:
            return colors.textMuted
        }
    }

    private func dueStatus(for date: Date) -> DueStatus {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let due = calendar.startOfDay(for: date)
        if due < today {
            return .overdue
        }
        guard let soonDate = calendar.date(byAdding: .day, value: 7, to: today) else {
            return .onTrack
        }
        return due <= soonDate ? .dueSoon : .onTrack
    }

    private func formattedDate(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return "Today"
        }
        if calendar.isDateInTomorrow(date) {
            return "Tomorrow"
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    private func parseDate(_ value: String) -> Date? {
        guard !value.isEmpty else { return nil }
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractionalFormatter.date(from: value) {
            return date
        }
        let isoFormatter = ISO8601DateFormatter()
        if let date = isoFormatter.date(from: value) {
            return date
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)
    }
}

private struct ProjectDeadlineSummaryView: View {
    @Environment(\.colorScheme) private var colorScheme
    let workload: ProjectWorkloadSummary
    let accent: Color

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let columns = [GridItem(.flexible()), GridItem(.flexible())]

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            if workload.hasSignals {
                LazyVGrid(columns: columns, alignment: .leading, spacing: PFSpacing.sm) {
                    if workload.urgentTasks > 0 {
                        ProjectSignalChip(
                            title: "Urgent Tasks",
                            value: workload.urgentTasks,
                            systemImage: "exclamationmark.triangle.fill",
                            tint: colors.error
                        )
                    }

                    if workload.urgentIssues > 0 {
                        ProjectSignalChip(
                            title: "Urgent Issues",
                            value: workload.urgentIssues,
                            systemImage: "ladybug",
                            tint: colors.warning
                        )
                    }

                    if workload.overdueCount > 0 {
                        ProjectSignalChip(
                            title: "Overdue",
                            value: workload.overdueCount,
                            systemImage: "calendar.badge.exclamationmark",
                            tint: colors.error
                        )
                    }

                    if workload.dueSoonCount > 0 {
                        ProjectSignalChip(
                            title: "Due Soon",
                            value: workload.dueSoonCount,
                            systemImage: "calendar",
                            tint: accent
                        )
                    }
                }

                if let nextDue = workload.nextDueItem {
                    ProjectDeadlineRow(item: nextDue)
                }
            } else {
                Text("No urgent workload signals.")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
            }
        }
    }
}

private struct ProjectSignalChip: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let value: Int
    let systemImage: String
    let tint: Color

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: PFSpacing.xs) {
            Image(systemName: systemImage)
                .font(.caption2)
                .foregroundStyle(tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(title.uppercased())
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(colors.textMuted)
                Text("\(value)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.textMain)
            }
            Spacer()
        }
        .padding(.horizontal, PFSpacing.sm)
        .padding(.vertical, PFSpacing.xs)
        .background(colors.surfacePaper)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

private struct ProjectDeadlineRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let item: ProjectDeadlineItem

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: PFSpacing.xs) {
                Image(systemName: "calendar")
                    .font(.caption)
                    .foregroundStyle(dueTone(for: item.dueDate))
                Text("Next due")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.textMuted)
                Spacer()
                Text(formattedDate(item.dueDate))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(dueTone(for: item.dueDate))
            }

            Text("\(item.type): \(item.title)")
                .font(.caption)
                .foregroundStyle(colors.textMuted)
                .lineLimit(1)
        }
    }

    private func dueTone(for date: Date) -> Color {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let due = calendar.startOfDay(for: date)
        if due < today {
            return colors.error
        }
        guard let soon = calendar.date(byAdding: .day, value: 7, to: today) else {
            return colors.textMuted
        }
        return due <= soon ? colors.warning : colors.textMuted
    }

    private func formattedDate(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return "Today"
        }
        if calendar.isDateInTomorrow(date) {
            return "Tomorrow"
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }
}

private struct ProjectActivityStrip: View {
    @Environment(\.colorScheme) private var colorScheme
    let activity: [ActivityItem]
    let maxItems: Int
    let accent: Color

    private struct ActivityTone {
        let icon: String
        let tint: Color
        let background: Color
    }

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            HStack {
                Text("Recent Activity")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                Spacer()
                Text("\(activity.count)")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(colors.textMuted)
            }

            if activity.isEmpty {
                Text("No recent updates.")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
            } else {
                ForEach(activity.prefix(maxItems)) { item in
                    let tone = activityTone(for: item)
                    HStack(alignment: .top, spacing: PFSpacing.sm) {
                        Circle()
                            .fill(tone.background)
                            .frame(width: 28, height: 28)
                            .overlay(
                                Image(systemName: tone.icon)
                                    .font(.caption)
                                    .foregroundStyle(tone.tint)
                            )

                        VStack(alignment: .leading, spacing: 2) {
                            Text(activitySummary(for: item))
                                .font(.caption)
                                .foregroundStyle(colors.textMain)
                                .lineLimit(2)

                            Text(relativeTime(item.createdAt?.dateValue()))
                                .font(.caption2)
                                .foregroundStyle(colors.textMuted)
                        }
                    }
                }
            }
        }
    }

    private func activitySummary(for item: ActivityItem) -> String {
        var parts: [String] = []
        if !item.user.isEmpty { parts.append(item.user) }
        if !item.action.isEmpty { parts.append(item.action) }
        if !item.target.isEmpty {
            parts.append(item.target)
        } else if !item.details.isEmpty {
            parts.append(item.details)
        }
        return parts.isEmpty ? "Activity update" : parts.joined(separator: " ")
    }

    private func activityTone(for item: ActivityItem) -> ActivityTone {
        let summary = "\(item.action) \(item.target) \(item.details)".lowercased()
        let success = ActivityTone(icon: "checkmark.circle.fill", tint: colors.success, background: colors.success.opacity(0.15))
        let warning = ActivityTone(icon: "exclamationmark.triangle.fill", tint: colors.warning, background: colors.warning.opacity(0.15))
        let error = ActivityTone(icon: "trash", tint: colors.error, background: colors.error.opacity(0.15))
        let primary = ActivityTone(icon: "sparkles", tint: accent, background: accent.opacity(0.15))
        let neutral = ActivityTone(icon: "clock", tint: colors.textMuted, background: colors.surfaceHover)

        if summary.contains("delete") || summary.contains("removed") {
            return error
        }
        if summary.contains("reopen") {
            return ActivityTone(icon: "arrow.uturn.left", tint: colors.warning, background: colors.warning.opacity(0.15))
        }
        if summary.contains("completed") || summary.contains("done") {
            return success
        }
        if summary.contains("issue") || summary.contains("bug") {
            return ActivityTone(icon: "ladybug", tint: colors.error, background: colors.error.opacity(0.15))
        }
        if summary.contains("task") {
            return ActivityTone(icon: "checkmark.circle", tint: accent, background: accent.opacity(0.15))
        }
        if summary.contains("status") {
            return ActivityTone(icon: "arrow.left.arrow.right", tint: accent, background: accent.opacity(0.15))
        }
        if summary.contains("report") || summary.contains("insight") {
            return primary
        }
        if summary.contains("comment") {
            return ActivityTone(icon: "bubble.left", tint: colors.warning, background: colors.warning.opacity(0.15))
        }
        if summary.contains("file") || summary.contains("upload") || summary.contains("attachment") {
            return ActivityTone(icon: "paperclip", tint: colors.textMuted, background: colors.surfaceHover)
        }
        if summary.contains("member") || summary.contains("invite") {
            return ActivityTone(icon: "person.badge.plus", tint: colors.success, background: colors.success.opacity(0.15))
        }
        if summary.contains("commit") {
            return ActivityTone(
                icon: "chevron.left.slash.chevron.right",
                tint: accent,
                background: accent.opacity(0.15)
            )
        }
        if summary.contains("priority") {
            return warning
        }
        return neutral
    }

    private func relativeTime(_ date: Date?) -> String {
        guard let date else { return "Just now" }
        let seconds = Int(Date().timeIntervalSince(date))
        if seconds < 60 { return "Just now" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h ago" }
        let days = hours / 24
        return "\(days)d ago"
    }
}

private struct ProjectResourceStrip: View {
    @Environment(\.colorScheme) private var colorScheme
    let links: [ProjectLink]

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        let resolvedLinks = links.compactMap { link -> (ProjectLink, URL)? in
            guard let url = normalizedURL(link.url) else { return nil }
            return (link, url)
        }

        if !resolvedLinks.isEmpty {
            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                Text("Resources")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.textMain)

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: PFSpacing.xs) {
                        ForEach(Array(resolvedLinks.prefix(3).enumerated()), id: \.offset) { _, entry in
                            let link = entry.0
                            let url = entry.1
                            Link(destination: url) {
                                ActionChip(title: link.title, systemImage: "link", tint: colors.textMain)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
        }
    }

    private func normalizedURL(_ raw: String) -> URL? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        if let url = URL(string: trimmed), url.scheme != nil {
            return url
        }
        return URL(string: "https://\(trimmed)")
    }
}

private struct ProjectTeamStrip: View {
    @Environment(\.colorScheme) private var colorScheme
    @ObservedObject var teamStore: ProjectTeamStore
    let memberIds: [String]
    let maxVisible: Int

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            HStack {
                Text("Team")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                Spacer()
                Text("\(memberIds.count)")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(colors.textMuted)
            }

            if memberIds.isEmpty {
                Text("No team members yet.")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
            } else {
                let visibleIds = Array(memberIds.prefix(maxVisible))
                let overflow = max(0, memberIds.count - visibleIds.count)
                HStack(spacing: -6) {
                    ForEach(visibleIds, id: \.self) { userId in
                        ProjectMemberAvatar(
                            profile: teamStore.profilesById[userId],
                            presence: teamStore.presenceById[userId]
                        )
                    }

                    if overflow > 0 {
                        ProjectOverflowAvatar(count: overflow)
                    }
                }
            }
        }
        .onAppear {
            teamStore.ensureProfiles(for: memberIds)
        }
        .onChange(of: memberIds) { _, ids in
            teamStore.ensureProfiles(for: ids)
        }
    }
}

private struct ProjectMemberAvatar: View {
    @Environment(\.colorScheme) private var colorScheme
    let profile: UserProfile?
    let presence: PresenceSnapshot?

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let size: CGFloat = 30

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            ZStack {
                Circle()
                    .fill(colors.surfacePaper)
                    .frame(width: size, height: size)

                if let urlString = profile?.photoURL, let url = URL(string: urlString) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable().scaledToFill()
                        default:
                            initialsView
                        }
                    }
                    .frame(width: size, height: size)
                    .clipShape(Circle())
                } else {
                    initialsView
                }
            }
            .overlay(Circle().stroke(colors.surfaceBorder, lineWidth: 1))

            Circle()
                .fill(presenceColor)
                .frame(width: 8, height: 8)
                .overlay(Circle().stroke(colors.surfaceCard, lineWidth: 1))
        }
    }

    private var initialsView: some View {
        Text(initials)
            .font(.caption.weight(.semibold))
            .foregroundStyle(colors.textMain)
    }

    private var initials: String {
        guard let name = profile?.displayName, !name.isEmpty else {
            return "?"
        }
        let parts = name.split(separator: " ")
        let initials = parts.prefix(2).compactMap { $0.first }
        return String(initials)
    }

    private var presenceColor: Color {
        guard let presence else { return colors.textSubtle }
        if presence.isOnline { return colors.success }
        if presence.isIdle { return colors.warning }
        if presence.isBusy { return colors.error }
        return colors.textSubtle
    }
}

private struct ProjectOverflowAvatar: View {
    @Environment(\.colorScheme) private var colorScheme
    let count: Int

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Text("+\(count)")
            .font(.caption.weight(.semibold))
            .foregroundStyle(colors.textMuted)
            .frame(width: 30, height: 30)
            .background(colors.surfacePaper)
            .clipShape(Circle())
            .overlay(Circle().stroke(colors.surfaceBorder, lineWidth: 1))
    }
}

private struct ProjectPulseRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let metrics: ProjectMetrics
    let accent: Color

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: PFSpacing.sm) {
            ProjectStatChip(
                title: "Open Tasks",
                value: metrics.openTaskCount,
                systemImage: "checklist",
                tint: accent
            )

            ProjectStatChip(
                title: "Open Issues",
                value: metrics.openIssueCount,
                systemImage: "exclamationmark.triangle",
                tint: colors.warning
            )
        }
    }
}

private struct ProjectStatChip: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let value: Int
    let systemImage: String
    let tint: Color

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: PFSpacing.xs) {
            Image(systemName: systemImage)
                .font(.caption)
                .foregroundStyle(tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(title.uppercased())
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(colors.textMuted)
                Text("\(value)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.textMain)
            }
        }
        .padding(.horizontal, PFSpacing.sm)
        .padding(.vertical, PFSpacing.xs)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(colors.surfacePaper)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

private struct ProjectDateStack: View {
    @Environment(\.colorScheme) private var colorScheme
    let label: String
    let value: String
    let valueColor: Color

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(colors.textMuted)
            Text(value)
                .font(.caption.weight(.semibold))
                .foregroundStyle(valueColor)
        }
    }
}

private struct QuickEditContext: Identifiable {
    let id: String
    let project: Project
}

private struct ProjectQuickEditSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    let project: Project
    let onSave: ([String: Any]) async -> Void
    let onCancel: () -> Void

    @State private var status: String
    @State private var priority: String
    @State private var hasDueDate: Bool
    @State private var dueDate: Date
    @State private var isSaving = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let baselineStatus: String
    private let baselinePriority: String
    private let statuses = ["Active", "In Progress", "Planning", "On Hold", "Completed"]
    private let priorities = ["Urgent", "High", "Medium", "Low"]

    private var statusOptions: [String] {
        if statuses.contains(status) {
            return statuses
        }
        return [status] + statuses
    }
    private var priorityOptions: [String] {
        if priorities.contains(priority) {
            return priorities
        }
        return [priority] + priorities
    }

    init(
        project: Project,
        onSave: @escaping ([String: Any]) async -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.project = project
        self.onSave = onSave
        self.onCancel = onCancel
        baselineStatus = project.status
        baselinePriority = project.priority.isEmpty ? "Medium" : project.priority
        _status = State(initialValue: baselineStatus)
        _priority = State(initialValue: baselinePriority)
        if let date = Self.parseDate(project.dueDate) {
            _hasDueDate = State(initialValue: true)
            _dueDate = State(initialValue: date)
        } else {
            _hasDueDate = State(initialValue: false)
            _dueDate = State(initialValue: Date())
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpacing.lg) {
                    Text("Quick Edit")
                        .font(.title2.weight(.semibold))
                        .foregroundStyle(colors.textMain)

                    VStack(alignment: .leading, spacing: PFSpacing.xs) {
                        Text("Status")
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)

                        Picker("Status", selection: $status) {
                            ForEach(statusOptions, id: \.self) { value in
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
                            ForEach(priorityOptions, id: \.self) { value in
                                Text(value).tag(value)
                            }
                        }
                        .pickerStyle(.menu)
                    }

                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        Toggle(isOn: $hasDueDate) {
                            Text("Set Due Date")
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(colors.textMain)
                        }

                        if hasDueDate {
                            DatePicker(
                                "Due Date",
                                selection: $dueDate,
                                displayedComponents: [.date]
                            )
                            .datePickerStyle(.graphical)
                        }
                    }

                    PFPrimaryButton(title: isSaving ? "Saving..." : "Save Changes", isLoading: isSaving) {
                        _Concurrency.Task {
                            await handleSave()
                        }
                    }

                    PFSecondaryButton(title: "Cancel") {
                        onCancel()
                        dismiss()
                    }
                }
                .padding(PFSpacing.lg)
            }
            .background(colors.surfaceBg.ignoresSafeArea())
            .navigationTitle(project.title)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        onCancel()
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func handleSave() async {
        if isSaving { return }
        var updates: [String: Any] = [:]

        if status != baselineStatus {
            updates["status"] = status
        }
        if priority != baselinePriority {
            updates["priority"] = priority
        }

        if hasDueDate {
            let formatted = Self.formatDate(dueDate)
            if formatted != project.dueDate {
                updates["dueDate"] = formatted
            }
        } else if !project.dueDate.isEmpty {
            updates["dueDate"] = ""
        }

        guard !updates.isEmpty else {
            dismiss()
            return
        }

        isSaving = true
        await onSave(updates)
        isSaving = false
        onCancel()
        dismiss()
    }

    private static func parseDate(_ value: String) -> Date? {
        guard !value.isEmpty else { return nil }
        let fractionalFormatter = ISO8601DateFormatter()
        fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractionalFormatter.date(from: value) {
            return date
        }
        let isoFormatter = ISO8601DateFormatter()
        if let date = isoFormatter.date(from: value) {
            return date
        }
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: value)
    }

    private static func formatDate(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}

private struct HealthDetailContext: Identifiable {
    let id: String
    let project: Project
    let health: ProjectHealthSnapshot
    let metrics: ProjectMetrics
    let workload: ProjectWorkloadSummary
    let activity: [ActivityItem]
}

private struct HealthDetailSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    let context: HealthDetailContext

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var statusColor: Color {
        switch context.health.status {
        case .critical:
            return colors.error
        case .warning:
            return colors.warning
        case .healthy, .excellent:
            return colors.success
        case .normal:
            return colors.primary
        case .stalemate:
            return colors.textSubtle
        }
    }
    private var localizedHighlights: [String] {
        HealthLocalization.highlights(for: context.health)
    }
    private var localizedRecommendations: [String] {
        HealthLocalization.recommendations(
            keys: context.health.recommendationKeys,
            fallbacks: context.health.recommendations
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpacing.lg) {
                    PFSectionHeader(
                        title: "Health Detail",
                        subtitle: "Signals and recommendations for this project."
                    )

                    PFCard {
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            HStack(alignment: .top) {
                                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                                    Text("Health Score")
                                        .font(.caption.weight(.semibold))
                                        .foregroundStyle(colors.textMuted)

                                    Text(context.project.title)
                                        .font(.headline)
                                        .foregroundStyle(colors.textMain)

                                    Text(formattedTimestamp(context.health.lastUpdated))
                                        .font(.caption2)
                                        .foregroundStyle(colors.textMuted)
                                }

                                Spacer()

                                HealthScoreBadge(
                                    score: context.health.score,
                                    status: context.health.status.label,
                                    color: statusColor
                                )
                            }

                            HStack(spacing: PFSpacing.sm) {
                                StatusPill(
                                    text: context.health.status.label,
                                    tint: statusColor.opacity(0.15),
                                    textColor: statusColor
                                )
                                Text("Trend: \(context.health.trend.label)")
                                    .font(.caption)
                                    .foregroundStyle(colors.textMuted)
                            }

                            if !localizedHighlights.isEmpty {
                                HStack(spacing: PFSpacing.xs) {
                                    ForEach(Array(localizedHighlights.prefix(3).enumerated()), id: \.offset) { _, highlight in
                                        HighlightChip(text: highlight, tint: statusColor)
                                    }
                                }
                            }
                        }
                    }

                    PFCard {
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            PFSectionHeader(title: "Workload")
                            HStack(spacing: PFSpacing.sm) {
                                MetricChip(title: "Open Tasks", value: context.metrics.openTaskCount, tint: statusColor)
                                MetricChip(title: "Open Issues", value: context.metrics.openIssueCount, tint: colors.warning)
                            }
                            ProjectDeadlineSummaryView(workload: context.workload, accent: statusColor)
                        }
                    }

                    PFCard {
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            PFSectionHeader(title: "Drivers")

                            if context.health.factors.isEmpty {
                                Text("No notable health drivers yet.")
                                    .font(.caption)
                                    .foregroundStyle(colors.textMuted)
                            } else {
                                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                                    ForEach(context.health.factors, id: \.id) { factor in
                                        HealthFactorRow(factor: factor)
                                    }
                                }
                            }
                        }
                    }

                    PFCard {
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            PFSectionHeader(title: "Recommendations")

                            if localizedRecommendations.isEmpty {
                                Text("No recommendations available right now.")
                                    .font(.caption)
                                    .foregroundStyle(colors.textMuted)
                            } else {
                                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                                    ForEach(localizedRecommendations, id: \.self) { recommendation in
                                        HealthRecommendationRow(text: recommendation)
                                    }
                                }
                            }
                        }
                    }

                    PFCard {
                        ProjectActivityStrip(activity: context.activity, maxItems: 5, accent: statusColor)
                    }
                }
                .padding(PFSpacing.lg)
            }
            .background(colors.surfaceBg.ignoresSafeArea())
            .navigationTitle("Health")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func formattedTimestamp(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return "Updated \(formatter.string(from: date))"
    }
}

private struct HealthFactorRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let factor: HealthFactor

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var localizedLabel: String {
        HealthLocalization.label(for: factor)
    }
    private var localizedDescription: String {
        HealthLocalization.description(for: factor)
    }

    var body: some View {
        let style = factorStyle(for: factor.type)
        HStack(alignment: .top, spacing: PFSpacing.sm) {
            Circle()
                .fill(style.background)
                .frame(width: 28, height: 28)
                .overlay(
                    Image(systemName: style.icon)
                        .font(.caption)
                        .foregroundStyle(style.tint)
                )

            VStack(alignment: .leading, spacing: 2) {
                Text(localizedLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                Text(localizedDescription)
                    .font(.caption2)
                    .foregroundStyle(colors.textMuted)
            }

            Spacer()

            Text("\(factor.impact)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(style.tint)
        }
        .padding(.vertical, 2)
    }

    private func factorStyle(for type: HealthFactorType) -> (icon: String, tint: Color, background: Color) {
        switch type {
        case .positive:
            return ("arrow.up.right", colors.success, colors.success.opacity(0.15))
        case .negative:
            return ("exclamationmark.triangle.fill", colors.error, colors.error.opacity(0.15))
        case .neutral:
            return ("minus", colors.textMuted, colors.surfaceHover)
        }
    }
}

private struct HealthRecommendationRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let text: String

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(alignment: .top, spacing: PFSpacing.sm) {
            Image(systemName: "lightbulb")
                .font(.caption)
                .foregroundStyle(colors.warning)
            Text(text)
                .font(.caption)
                .foregroundStyle(colors.textMain)
        }
    }
}

private struct HealthScoreBadge: View {
    @Environment(\.colorScheme) private var colorScheme
    let score: Int
    let status: String
    let color: Color

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text("\(score)")
                .font(.headline.weight(.bold))
                .foregroundStyle(color)
            Text(status.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(colors.textMuted)
        }
        .padding(.horizontal, PFSpacing.sm)
        .padding(.vertical, PFSpacing.xs)
        .background(colors.surfacePaper)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

private struct StatusPill: View {
    @Environment(\.colorScheme) private var colorScheme
    let text: String
    let tint: Color
    var textColor: Color?

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(textColor ?? colors.textMain)
            .padding(.horizontal, PFSpacing.sm)
            .padding(.vertical, 4)
            .background(tint)
            .clipShape(Capsule())
    }
}

private struct MetricChip: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let value: Int
    let tint: Color

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: 6) {
            Text("\(value)")
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(tint)
            Text(title)
                .font(.caption)
                .foregroundStyle(colors.textMuted)
        }
        .padding(.horizontal, PFSpacing.sm)
        .padding(.vertical, 6)
        .background(colors.surfacePaper)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

private struct HighlightChip: View {
    @Environment(\.colorScheme) private var colorScheme
    let text: String
    let tint: Color

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(tint)
            .padding(.horizontal, PFSpacing.sm)
            .padding(.vertical, 6)
            .background(colors.surfacePaper)
            .clipShape(Capsule())
    }
}

private struct ActionChip: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let systemImage: String
    let tint: Color

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack(spacing: PFSpacing.xs) {
            Image(systemName: systemImage)
            Text(title)
        }
        .font(.caption.weight(.semibold))
        .foregroundStyle(tint)
        .padding(.horizontal, PFSpacing.sm)
        .padding(.vertical, 6)
        .background(colors.surfacePaper)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

private struct HealthStatChip: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let value: Int
    let color: Color

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(colors.textMuted)
            Text("\(value)")
                .font(.headline.weight(.bold))
                .foregroundStyle(color)
        }
        .padding(.horizontal, PFSpacing.sm)
        .padding(.vertical, PFSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(colors.surfacePaper)
        .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
    }
}

private struct HealthHighlightRow: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let score: Int
    let status: String
    let color: Color

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(colors.textMain)
                Text(status)
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)
            }

            Spacer()

            Text("\(score)")
                .font(.footnote.weight(.bold))
                .foregroundStyle(color)
        }
        .padding(.vertical, PFSpacing.xs)
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

                PFPrimaryButton(title: isEditing ? "Save Changes" : "Create Project") {
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

private struct ProjectFilterSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @Binding var sortOption: ProjectSortOption
    @Binding var filterStatus: Set<String>
    @Binding var filterPriority: Set<String>
    @Binding var filterOwner: Set<String>
    let projects: [Project]
    let ownerProfiles: [String: UserProfile]
    let currentUserId: String?

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let statuses = ["Active", "In Progress", "Planning", "On Hold", "Completed"]
    private let priorities = ["Urgent", "High", "Medium", "Low"]
    private var ownerIds: [String] {
        var unique: [String] = []
        for project in projects where !project.ownerId.isEmpty {
            if !unique.contains(project.ownerId) {
                unique.append(project.ownerId)
            }
        }
        return unique.sorted { ownerLabel(for: $0).localizedCaseInsensitiveCompare(ownerLabel(for: $1)) == .orderedAscending }
    }

    private var statusOptions: [String] {
        var options = statuses
        for status in projects.map(\.status) where !status.isEmpty && !options.contains(status) {
            options.append(status)
        }
        return options
    }

    private var priorityOptions: [String] {
        var options = priorities
        for priority in projects.map(\.priority) where !priority.isEmpty && !options.contains(priority) {
            options.append(priority)
        }
        return options
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: PFSpacing.lg) {
                    
                    // Sort Section
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        Text("Sort By")
                            .font(.headline)
                            .foregroundStyle(colors.textMain)
                        
                        ForEach(ProjectSortOption.allCases) { option in
                            Button {
                                sortOption = option
                            } label: {
                                HStack {
                                    Text(option.rawValue)
                                        .foregroundStyle(colors.textMain)
                                    Spacer()
                                    if sortOption == option {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(colors.primary)
                                    }
                                }
                                .padding()
                                .background(colors.surfacePaper)
                                .clipShape(RoundedRectangle(cornerRadius: PFRadius.md))
                            }
                        }
                    }

                    // Status Filter
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        Text("Status")
                            .font(.headline)
                            .foregroundStyle(colors.textMain)
                        
                        FlowLayout(spacing: PFSpacing.sm) {
                            ForEach(statusOptions, id: \.self) { status in
                                FilterChip(
                                    title: status,
                                    isSelected: filterStatus.contains(status),
                                    onTap: { toggleStatus(status) }
                                )
                            }
                        }
                    }

                    // Priority Filter
                    VStack(alignment: .leading, spacing: PFSpacing.sm) {
                        Text("Priority")
                            .font(.headline)
                            .foregroundStyle(colors.textMain)
                        
                        FlowLayout(spacing: PFSpacing.sm) {
                            ForEach(priorityOptions, id: \.self) { priority in
                                FilterChip(
                                    title: priority,
                                    isSelected: filterPriority.contains(priority),
                                    onTap: { togglePriority(priority) }
                                )
                            }
                        }
                    }

                    if !ownerIds.isEmpty {
                        VStack(alignment: .leading, spacing: PFSpacing.sm) {
                            Text("Owner")
                                .font(.headline)
                                .foregroundStyle(colors.textMain)

                            FlowLayout(spacing: PFSpacing.sm) {
                                ForEach(ownerIds, id: \.self) { ownerId in
                                    FilterChip(
                                        title: ownerLabel(for: ownerId),
                                        isSelected: filterOwner.contains(ownerId),
                                        onTap: { toggleOwner(ownerId) }
                                    )
                                }
                            }
                        }
                    }

                    Button {
                        sortOption = .title
                        filterStatus.removeAll()
                        filterPriority.removeAll()
                        filterOwner.removeAll()
                    } label: {
                        Text("Reset All")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(colors.error)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(colors.surfacePaper)
                            .clipShape(RoundedRectangle(cornerRadius: PFRadius.md))
                    }
                }
                .padding(PFSpacing.lg)
            }
            .background(colors.surfaceBg.ignoresSafeArea())
            .navigationTitle("Filter & Sort")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func toggleStatus(_ status: String) {
        if filterStatus.contains(status) {
            filterStatus.remove(status)
        } else {
            filterStatus.insert(status)
        }
    }

    private func togglePriority(_ priority: String) {
        if filterPriority.contains(priority) {
            filterPriority.remove(priority)
        } else {
            filterPriority.insert(priority)
        }
    }

    private func toggleOwner(_ ownerId: String) {
        if filterOwner.contains(ownerId) {
            filterOwner.remove(ownerId)
        } else {
            filterOwner.insert(ownerId)
        }
    }

    private func ownerLabel(for ownerId: String) -> String {
        if let currentUserId, ownerId == currentUserId {
            return "Me"
        }
        if let profile = ownerProfiles[ownerId], !profile.displayName.isEmpty {
            return profile.displayName
        }
        return "Owner \(ownerId.prefix(6))"
    }
}

private struct FilterChip: View {
    @Environment(\.colorScheme) private var colorScheme
    let title: String
    let isSelected: Bool
    let onTap: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Button(action: onTap) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(isSelected ? colors.primaryText : colors.textMain)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(isSelected ? colors.primary : colors.surfacePaper)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .strokeBorder(isSelected ? Color.clear : colors.surfaceBorder, lineWidth: 1)
                )
        }
    }
}
