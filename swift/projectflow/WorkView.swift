import SwiftUI

// MARK: - WorkView — Companion V2
//
// One cohesive Work tab: a single navigation stack, a segmented switch between
// Tasks / Initiatives / Personal, and one global "+" that quick-creates the
// right item for the active segment. Each segment renders as embedded content
// (no nested navigation stacks).

struct WorkView: View {
    @EnvironmentObject private var session: AppSession
    @Environment(\.colorScheme) private var colorScheme
    @State private var segment: WorkSegment = .tasks
    @StateObject private var projectsStore = ProjectsStore()
    @StateObject private var initiativesStore = InitiativesStore()
    @StateObject private var personalTasksStore = PersonalTasksStore()
    @State private var showQuickCreate = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    private var quickCreateType: QuickCreateType {
        switch segment {
        case .tasks: return .task
        case .initiatives: return .initiative
        case .personal: return .personal
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                VStack(spacing: 0) {
                    PFSegmentedControl(
                        segments: WorkSegment.allCases.map { .init(id: $0.rawValue, title: label(for: $0)) },
                        selection: Binding(
                            get: { segment.rawValue },
                            set: { if let next = WorkSegment(rawValue: $0) { withAnimation { segment = next } } }
                        )
                    )
                    .padding(.horizontal, PFSpacing.md)
                    .padding(.top, PFSpacing.sm)
                    .padding(.bottom, PFSpacing.sm)

                    segmentContent
                }
            }
            .navigationTitle(L10n.tr("work.title", fallback: "Work"))
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showQuickCreate = true } label: {
                        Image(systemName: "plus").foregroundStyle(colors.textMain)
                    }
                    .disabled(session.activeTenantId == nil)
                }
            }
        }
        .sheet(isPresented: $showQuickCreate) {
            QuickCreateSheet(
                tenantId: session.activeTenantId ?? "",
                projects: projectsStore.projects,
                initialType: quickCreateType,
                permissions: session.permissionContext()
            )
        }
        .onAppear { reloadStores() }
        .onChange(of: session.activeTenantId) { _, _ in reloadStores() }
        .onDisappear {
            projectsStore.stop()
            initiativesStore.stop()
            personalTasksStore.stop()
        }
    }

    @ViewBuilder
    private var segmentContent: some View {
        switch segment {
        case .tasks:
            TasksView()
        case .initiatives:
            InitiativesListView(store: initiativesStore)
        case .personal:
            PersonalTasksView(store: personalTasksStore)
        }
    }

    private func label(for segment: WorkSegment) -> String {
        switch segment {
        case .tasks: return L10n.tr("work.tasks", fallback: "Tasks")
        case .initiatives: return L10n.tr("work.initiatives", fallback: "Initiatives")
        case .personal: return L10n.tr("work.personal", fallback: "Personal")
        }
    }

    private func reloadStores() {
        guard let tenantId = session.activeTenantId else { return }
        projectsStore.start(tenantId: tenantId)
        initiativesStore.listenAllInTenant(tenantId: tenantId)
        personalTasksStore.start(tenantId: tenantId)
    }
}

// MARK: - Initiatives list (embedded)

struct InitiativesListView: View {
    @ObservedObject var store: InitiativesStore
    @EnvironmentObject private var session: AppSession
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Group {
            if store.isLoading && store.initiatives.isEmpty {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.initiatives.isEmpty {
                ScrollView {
                    PFEmptyState(
                        icon: "flag",
                        title: L10n.tr("work.empty.initiatives", fallback: "No initiatives yet"),
                        message: L10n.tr("work.empty.initiatives.message", fallback: "Initiatives group related work toward an outcome.")
                    )
                    .padding(.top, PFSpacing.xl)
                }
            } else {
                ScrollView(showsIndicators: false) {
                    VStack(spacing: PFSpacing.sm) {
                        ForEach(store.initiatives) { initiative in
                            NavigationLink {
                                ProjectInitiativeDetailView(
                                    initiative: initiative,
                                    tenantId: session.activeTenantId ?? initiative.tenantId,
                                    permissions: session.permissionContext()
                                )
                            } label: {
                                PFCard {
                                    PFListRow(
                                        title: initiative.title,
                                        subtitle: initiative.status,
                                        icon: "flag",
                                        iconTint: PFSemantic.healthTint(initiative.health, colors: colors)
                                    ) {
                                        if !initiative.priority.isEmpty {
                                            PFPriorityChip(priority: initiative.priority)
                                        }
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .pfScreenPadding(vertical: PFSpacing.md)
                    .pfTabBarClearance()
                    .tabBarScrollShrink()
                }
            }
        }
    }
}
