import SwiftUI

struct WorkView: View {
    @EnvironmentObject private var session: AppSession
    @State private var segment: WorkSegment = .tasks
    @StateObject private var initiativesStore = InitiativesStore()
    @StateObject private var personalTasksStore = PersonalTasksStore()

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("Work", selection: $segment) {
                    ForEach(WorkSegment.allCases, id: \.self) { seg in
                        Text(label(for: seg)).tag(seg)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, PFSpacing.md)
                .padding(.vertical, PFSpacing.sm)

                Group {
                    switch segment {
                    case .tasks:
                        TasksView()
                    case .initiatives:
                        InitiativesListView(store: initiativesStore)
                    case .personal:
                        PersonalTasksView(store: personalTasksStore)
                    }
                }
            }
            .background(AppBackground())
            .navigationTitle(L10n.tr("tabs.work", fallback: "Work"))
            .onAppear { reloadStores() }
            .onChange(of: session.activeTenantId) { _, _ in reloadStores() }
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
        initiativesStore.listenAllInTenant(tenantId: tenantId)
        personalTasksStore.start(tenantId: tenantId)
    }
}

struct InitiativesListView: View {
    @ObservedObject var store: InitiativesStore
    @EnvironmentObject private var session: AppSession
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    var body: some View {
        Group {
            if store.isLoading {
                ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if store.initiatives.isEmpty {
                ContentUnavailableView("No Initiatives", systemImage: "flag", description: Text("Create initiatives in a project to track larger outcomes."))
            } else {
                List(store.initiatives) { initiative in
                    NavigationLink {
                        ProjectInitiativeDetailView(
                            initiative: initiative,
                            tenantId: session.activeTenantId ?? initiative.tenantId,
                            permissions: session.permissionContext()
                        )
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(initiative.title).font(.headline)
                            HStack {
                                Text(initiative.status).font(.caption)
                                if !initiative.health.isEmpty {
                                    Text(initiative.health).font(.caption).foregroundStyle(colors.textMuted)
                                }
                            }
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
    }
}