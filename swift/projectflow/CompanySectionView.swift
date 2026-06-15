import SwiftUI

// MARK: - CompanySectionView — Companion V2
//
// Dedicated surface for the company / founding project. Surfaces stage,
// formation & launch readiness, linked workstreams and quick actions. Reachable
// from the Home dashboard's company command entry.

struct CompanySectionView: View {
    @Environment(\.colorScheme) private var colorScheme
    let companyProject: Project
    let tenantId: String

    @StateObject private var projectsStore = ProjectsStore()
    @StateObject private var tasksStore = TasksStore()
    @State private var showQuickCreate = false
    @State private var quickCreateType: QuickCreateType = .task

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var permissions: PermissionContext {
        AppSession.shared.permissionContext(project: companyProject)
    }

    private var workstreams: [Project] {
        projectsStore.projects.filter { $0.companyProjectId == companyProject.id && !$0.isCompanyProject }
    }

    private var openTaskCount: Int {
        tasksStore.tasks.filter { !$0.isCompleted }.count
    }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: PFSpacing.lg) {
                    header
                    readinessCard
                    actionsRow
                    workstreamsSection
                }
                .pfScreenPadding(vertical: PFSpacing.md)
                .pfTabBarClearance()
            }
        }
        .navigationTitle(L10n.tr("company.title", fallback: "Company"))
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showQuickCreate) {
            QuickCreateSheet(
                tenantId: tenantId,
                projects: projectsStore.projects,
                defaultProjectId: companyProject.id,
                initialType: quickCreateType,
                permissions: permissions
            )
        }
        .onAppear {
            projectsStore.start(tenantId: tenantId)
            tasksStore.start(tenantId: tenantId, projectId: companyProject.id)
        }
        .onDisappear {
            projectsStore.stop()
            tasksStore.stop()
        }
    }

    // MARK: Header

    private var header: some View {
        PFScreenHeader(
            title: companyProject.title,
            eyebrow: L10n.tr("company.title", fallback: "Company"),
            subtitle: stageSubtitle
        ) {
            PFIconTile(icon: "building.2", tint: colors.primary, size: 44)
        }
    }

    private var stageSubtitle: String {
        if let stage = companyProject.startupProfile?.stage, !stage.isEmpty {
            return "\(L10n.tr("company.stage", fallback: "Stage")): \(stage.capitalized)"
        }
        return L10n.tr("company.subtitle", fallback: "Your founding workspace")
    }

    // MARK: Readiness

    private var readinessCard: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                PFSectionTitle(title: L10n.tr("company.readiness", fallback: "Readiness"))

                let readiness = companyProject.startupReadiness
                HStack(spacing: PFSpacing.lg) {
                    readinessRing(
                        title: L10n.tr("company.formation", fallback: "Formation"),
                        percent: readiness?.formationPercent ?? 0,
                        tint: colors.primary
                    )
                    readinessRing(
                        title: L10n.tr("company.launch", fallback: "Launch"),
                        percent: readiness?.launchPercent ?? 0,
                        tint: colors.success
                    )
                    Spacer(minLength: 0)
                    VStack(alignment: .trailing, spacing: 4) {
                        Text("\(openTaskCount)")
                            .font(PFFont.title)
                            .foregroundStyle(colors.textMain)
                        Text(L10n.tr("dashboard.metrics.open", fallback: "Open tasks"))
                            .font(PFFont.detail)
                            .foregroundStyle(colors.textMuted)
                    }
                }
            }
        }
    }

    private func readinessRing(title: String, percent: Int, tint: Color) -> some View {
        VStack(spacing: PFSpacing.xs) {
            PFCircularProgress(value: Double(percent) / 100, tint: tint, size: 66, label: "\(percent)%")
            Text(title)
                .font(PFFont.chip)
                .foregroundStyle(colors.textMuted)
        }
    }

    // MARK: Actions

    private var actionsRow: some View {
        VStack(spacing: PFSpacing.sm) {
            NavigationLink {
                ProjectOverviewView(project: companyProject, tenantId: tenantId)
            } label: {
                HStack {
                    Text(L10n.tr("company.open", fallback: "Open company project"))
                        .font(PFFont.rowTitle)
                    Spacer()
                    Image(systemName: "arrow.right").font(.caption.weight(.bold))
                }
                .foregroundStyle(colors.primaryText)
                .padding(.vertical, PFSpacing.sm + 2)
                .padding(.horizontal, PFSpacing.md)
                .background(colors.primary)
                .clipShape(RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous))
            }
            .buttonStyle(.plain)

            HStack(spacing: PFSpacing.sm) {
                PFQuickActionButton(title: L10n.tr("quickCreate.type.task", fallback: "Task"), icon: "checklist", tint: colors.warning) {
                    quickCreateType = .task
                    showQuickCreate = true
                }
                PFQuickActionButton(title: L10n.tr("company.addWorkstream", fallback: "Workstream"), icon: "square.stack.3d.up", tint: colors.primary) {
                    quickCreateType = .project
                    showQuickCreate = true
                }
            }
        }
    }

    // MARK: Workstreams

    private var workstreamsSection: some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            PFSectionTitle(title: L10n.tr("company.workstreams", fallback: "Workstreams"))
            if workstreams.isEmpty {
                PFCard {
                    PFEmptyState(
                        icon: "square.stack.3d.up.slash",
                        title: L10n.tr("company.workstreams.empty", fallback: "No linked workstreams yet.")
                    )
                }
            } else {
                VStack(spacing: PFSpacing.sm) {
                    ForEach(workstreams) { project in
                        NavigationLink {
                            ProjectOverviewView(project: project, tenantId: tenantId)
                        } label: {
                            PFCard {
                                PFListRow(
                                    title: project.title,
                                    subtitle: "\(Int(project.progress))%",
                                    icon: "square.stack.3d.up",
                                    iconTint: PFSemantic.statusTint(project.status, colors: colors)
                                ) {
                                    PFStatusChip(status: project.status)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }
}
