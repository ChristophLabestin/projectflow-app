import SwiftUI

struct ProjectsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var store = ProjectsStore()
    @StateObject private var tenantStore = TenantStore()
    @StateObject private var pinnedProjectStore = PinnedProjectStore()
    @StateObject private var insightsStore = ProjectInsightsStore()
    @StateObject private var focusStore = FocusProjectStore()
    @State private var showingEditor = false
    @State private var editingProject: Project?
    @State private var draftTitle = ""
    @State private var draftDescription = ""
    @State private var draftStatus = "Active"
    @State private var deletingProject: Project?
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        let base = AnyView(
            NavigationStack {
                ZStack {
                    AppBackground()
                    ScrollView(showsIndicators: false) {
                        content
                    }
                }
                .navigationTitle("Projects")
                .toolbar { projectsToolbar }
            }
        )
        let withAppear = AnyView(base.onAppear {
            tenantStore.update(for: session.user)
        })
        let withSessionChange = AnyView(withAppear.onChange(of: session.user) { _, user in
            tenantStore.update(for: user)
        })
        let withTenantChange = AnyView(withSessionChange.onChange(of: tenantStore.activeTenantId) { _, tenantId in
            if let tenantId {
                store.start(tenantId: tenantId)
                pinnedProjectStore.start(tenantId: tenantId)
                insightsStore.start(tenantId: tenantId)
                focusStore.start(tenantId: tenantId)
            } else {
                store.stop()
                pinnedProjectStore.stop()
                insightsStore.stop()
                focusStore.stop()
            }
        })
        let withDisappear = AnyView(withTenantChange.onDisappear {
            store.stop()
            tenantStore.stop()
            pinnedProjectStore.stop()
            insightsStore.stop()
            focusStore.stop()
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

        return withDialog
    }

    @ToolbarContentBuilder
    private var projectsToolbar: some ToolbarContent {
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
                loadingSection
                errorSection
                spotlightSection
                focusSection
                healthHighlightsSection
                listSection
            }
            .padding(PFSpacing.lg)
        )
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.xs) {
            Text("Workspace Portfolio")
                .font(.title2.weight(.semibold))
                .foregroundStyle(colors.textMain)

            Text("Spotlight priorities, watch health signals, and keep the team aligned.")
                .font(.subheadline)
                .foregroundStyle(colors.textMuted)
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
        if let error = store.errorMessage ?? insightsStore.errorMessage ?? focusStore.errorMessage {
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
            SpotlightHeroCard(
                mode: .spotlight,
                project: project,
                metrics: metrics,
                health: health,
                isFocused: focusStore.focusProjectId == project.id,
                isPinned: pinnedProjectStore.pinnedProjectId == project.id,
                onFocusToggle: { toggleFocus(for: project) },
                onPinToggle: { togglePinned(project) },
                onEdit: { beginEdit(project) },
                onDelete: { deletingProject = project },
                destination: ProjectOverviewView(project: project, tenantId: resolvedTenantId(for: project))
            )
        }
    }

    @ViewBuilder
    private var focusSection: some View {
        if let project = focusProject, project.id != spotlightProject?.id {
            let metrics = insightsStore.metrics(for: project.id)
            let health = insightsStore.health(for: project.id)
            SpotlightHeroCard(
                mode: .focus,
                project: project,
                metrics: metrics,
                health: health,
                isFocused: true,
                isPinned: pinnedProjectStore.pinnedProjectId == project.id,
                onFocusToggle: { toggleFocus(for: project) },
                onPinToggle: { togglePinned(project) },
                onEdit: { beginEdit(project) },
                onDelete: { deletingProject = project },
                destination: ProjectOverviewView(project: project, tenantId: resolvedTenantId(for: project))
            )
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
        } else {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                PFSectionHeader(title: "All Projects")

                VStack(spacing: PFSpacing.md) {
                    ForEach(projectsForGrid) { project in
                        ProjectListCard(
                            project: project,
                            metrics: insightsStore.metrics(for: project.id),
                            health: insightsStore.health(for: project.id),
                            isPinned: pinnedProjectStore.pinnedProjectId == project.id,
                            isFocused: focusStore.focusProjectId == project.id,
                            onFocusToggle: { toggleFocus(for: project) },
                            onPinToggle: { togglePinned(project) },
                            onEdit: { beginEdit(project) },
                            onDelete: { deletingProject = project },
                            destination: ProjectOverviewView(project: project, tenantId: resolvedTenantId(for: project))
                        )
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
        return store.projects.first
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
    let isFocused: Bool
    let isPinned: Bool
    let onFocusToggle: () -> Void
    let onPinToggle: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    let destination: Destination

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var accent: Color {
        switch health.status {
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

    var body: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            Text(mode.rawValue.uppercased())
                .font(.caption.weight(.semibold))
                .foregroundStyle(accent)

            ZStack {
                RoundedRectangle(cornerRadius: PFRadius.xl, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                (mode == .focus ? colors.primary : accent).opacity(0.18),
                                colors.surfaceCard
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .shadow(color: colors.shadowSm, radius: 10, x: 0, y: 6)

                VStack(alignment: .leading, spacing: PFSpacing.md) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: PFSpacing.xs) {
                            Text(project.title)
                                .font(.title2.weight(.bold))
                                .foregroundStyle(colors.textMain)

                            Text(project.description.isEmpty ? "No description yet." : project.description)
                                .font(.subheadline)
                                .foregroundStyle(colors.textMuted)
                                .lineLimit(3)
                        }

                        Spacer()

                        VStack(alignment: .trailing, spacing: PFSpacing.xs) {
                            HealthScoreBadge(score: health.score, status: health.status.label, color: accent)

                            if isFocused {
                                StatusPill(text: "Focused", tint: colors.primary, textColor: colors.primaryText)
                            }
                        }
                    }

                    HStack(spacing: PFSpacing.sm) {
                        MetricChip(title: "Tasks", value: metrics.taskCount, tint: accent)
                        MetricChip(title: "Flows", value: metrics.flowCount, tint: accent)
                        MetricChip(title: "Issues", value: metrics.issueCount, tint: accent)
                    }

                    HStack(spacing: PFSpacing.xs) {
                        ForEach(Array(health.highlights.prefix(3).enumerated()), id: \.offset) { _, highlight in
                            HighlightChip(text: highlight, tint: accent)
                        }
                    }

                    HStack(spacing: PFSpacing.sm) {
                        NavigationLink {
                            destination
                        } label: {
                            ActionChip(title: "Open Project", systemImage: "arrow.up.right", tint: colors.textMain)
                        }
                        .buttonStyle(.plain)

                        Button(action: onFocusToggle) {
                            ActionChip(
                                title: isFocused ? "Clear Focus" : "Set Focus",
                                systemImage: "viewfinder",
                                tint: colors.textMain
                            )
                        }
                        .buttonStyle(.plain)

                        Button(action: onPinToggle) {
                            ActionChip(
                                title: isPinned ? "Pinned" : "Pin",
                                systemImage: isPinned ? "pin.fill" : "pin",
                                tint: colors.textMain
                            )
                        }
                        .buttonStyle(.plain)

                        Spacer()

                        Menu {
                            Button("Edit") { onEdit() }
                            Button("Delete", role: .destructive) { onDelete() }
                        } label: {
                            Image(systemName: "ellipsis")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(colors.textMuted)
                                .padding(8)
                                .background(colors.surfacePaper)
                                .clipShape(Circle())
                        }
                    }
                }
                .padding(PFSpacing.lg)
            }
        }
    }
}

private struct ProjectListCard<Destination: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    let project: Project
    let metrics: ProjectMetrics
    let health: ProjectHealthSnapshot
    let isPinned: Bool
    let isFocused: Bool
    let onFocusToggle: () -> Void
    let onPinToggle: () -> Void
    let onEdit: () -> Void
    let onDelete: () -> Void
    let destination: Destination

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var accent: Color {
        switch health.status {
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

    var body: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: PFSpacing.xs) {
                        HStack(spacing: PFSpacing.xs) {
                            Text(project.title)
                                .font(.headline)
                                .foregroundStyle(colors.textMain)

                            if isPinned {
                                Image(systemName: "pin.fill")
                                    .font(.caption)
                                    .foregroundStyle(colors.textMuted)
                            }
                        }

                        Text(project.description.isEmpty ? "No description yet." : project.description)
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                            .lineLimit(2)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: PFSpacing.xs) {
                        HealthScoreBadge(score: health.score, status: health.status.label, color: accent)
                        StatusPill(text: project.status, tint: colors.surfaceHover)
                    }
                }

                HStack(spacing: PFSpacing.sm) {
                    MetricChip(title: "Tasks", value: metrics.taskCount, tint: accent)
                    MetricChip(title: "Flows", value: metrics.flowCount, tint: accent)
                    MetricChip(title: "Issues", value: metrics.issueCount, tint: accent)
                }

                HStack(spacing: PFSpacing.sm) {
                    NavigationLink {
                        destination
                    } label: {
                        ActionChip(title: "Open", systemImage: "arrow.up.right", tint: colors.textMain)
                    }
                    .buttonStyle(.plain)

                    Button(action: onFocusToggle) {
                        ActionChip(
                            title: isFocused ? "Focused" : "Set Focus",
                            systemImage: "viewfinder",
                            tint: colors.textMain
                        )
                    }
                    .buttonStyle(.plain)

                    Button(action: onPinToggle) {
                        ActionChip(
                            title: isPinned ? "Pinned" : "Pin",
                            systemImage: isPinned ? "pin.fill" : "pin",
                            tint: colors.textMain
                        )
                    }
                    .buttonStyle(.plain)

                    Spacer()

                    Menu {
                        Button("Edit") { onEdit() }
                        Button("Delete", role: .destructive) { onDelete() }
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
        .shadow(
            color: isFocused ? colors.primary.opacity(0.25) : colors.shadowSm,
            radius: isFocused ? 16 : 8,
            x: 0,
            y: isFocused ? 8 : 4
        )
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
