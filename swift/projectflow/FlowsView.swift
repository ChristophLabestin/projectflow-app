import SwiftUI

enum FlowViewMode: String, CaseIterable, Identifiable {
    case list = "List"
    case board = "Board"
    var id: String { rawValue }
    
    var icon: String {
        switch self {
        case .list: return "list.bullet"
        case .board: return "square.grid.3x2"
        }
    }
}

enum FlowType: String, CaseIterable, Identifiable {
    case feature = "Feature"
    case product = "Product"
    case optimization = "Optimization"
    case marketing = "Marketing"
    case moonshot = "Moonshot"
    var id: String { rawValue }
    
    var icon: String {
        switch self {
        case .feature: return "hammer"
        case .product: return "cube"
        case .optimization: return "bolt"
        case .marketing: return "megaphone"
        case .moonshot: return "rocket"
        }
    }
}

struct FlowsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @StateObject private var tenantStore = TenantStore()
    @StateObject private var projectsStore = ProjectsStore()
    @StateObject private var flowsStore = FlowsStore()
    @State private var selectedProjectId: String?
    @State private var showingEditor = false
    @State private var editingFlow: Flow?
    @State private var draftTitle = ""
    @State private var draftDescription = ""
    @State private var draftType = "Feature"
    @State private var draftStage = "Brainstorm"
    @State private var deletingFlow: Flow?
    
    // New States
    @State private var searchText = ""
    @State private var selectedType: FlowType = .feature
    @State private var viewMode: FlowViewMode = .list
    @State private var showingSnapToFlow = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var selectedProject: Project? {
        projectsStore.projects.first { $0.id == selectedProjectId }
    }
    private var selectedTenantId: String? {
        selectedProject?.tenantId ?? tenantStore.activeTenantId
    }
    
    private var filteredFlows: [Flow] {
        var result = flowsStore.flows
        
        // Filter by Type (Pipeline)
        result = result.filter { $0.type == selectedType.rawValue }
        
        // Search
        if !searchText.isEmpty {
            result = result.filter { $0.title.localizedCaseInsensitiveContains(searchText) || $0.description.localizedCaseInsensitiveContains(searchText) }
        }
        
        return result
    }

    var body: some View {
        NavigationStack {
            ZStack {
                AppBackground()
                
                VStack(spacing: 0) {
                    pipelineTabs
                    
                    if viewMode == .list {
                        ScrollView {
                            content
                        }
                    } else {
                        FlowBoardView(
                            flows: filteredFlows,
                            tenantId: tenantStore.activeTenantId ?? "",
                            projectsStore: projectsStore,
                            tenantStore: tenantStore,
                            onEdit: { beginEdit($0) },
                            onDelete: { deletingFlow = $0 }
                        )
                    }
                }
            }
            .navigationTitle("Flows")
            .searchable(text: $searchText, prompt: "Search flows...")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Picker("View Mode", selection: $viewMode) {
                        ForEach(FlowViewMode.allCases) { mode in
                            Image(systemName: mode.icon).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .frame(width: 80)
                }
                
                ToolbarItem(placement: .topBarTrailing) {
                    HStack {
                        Button {
                            showingSnapToFlow = true
                        } label: {
                            Image(systemName: "camera.viewfinder")
                                .foregroundStyle(colors.primary)
                        }
                        
                        Button {
                            beginCreate()
                        } label: {
                            Image(systemName: "plus")
                                .foregroundStyle(colors.textMain)
                        }
                        .disabled(selectedProjectId == nil || flowsStore.isLoading)
                    }
                }
            }
            .sheet(isPresented: $showingSnapToFlow) {
                SnapToFlowView(
                    tenantId: selectedTenantId ?? "",
                    projectId: selectedProjectId ?? "",
                    permissions: tenantStore.permissionContext(projectOwnerId: selectedProject?.ownerId)
                )
            }
            .sheet(isPresented: $showingEditor) {
                FlowEditorView(
                    isEditing: editingFlow != nil,
                    title: $draftTitle,
                    description: $draftDescription,
                    type: $draftType,
                    stage: $draftStage
                ) {
                    await saveFlow()
                } onCancel: {
                    showingEditor = false
                }
            }
            .confirmationDialog(
                "Delete Flow?",
                isPresented: Binding(
                    get: { deletingFlow != nil },
                    set: { if !$0 { deletingFlow = nil } }
                ),
                titleVisibility: SwiftUI.Visibility.visible
            ) {
                Button("Delete", role: .destructive) {
                    guard let flow = deletingFlow else { return }
                    _Concurrency.Task {
                        await deleteFlow(flow)
                        deletingFlow = nil
                    }
                }
                Button("Cancel", role: .cancel) {
                    deletingFlow = nil
                }
            } message: {
                Text("This will permanently remove the flow.")
            }
        }
        .onAppear {
            tenantStore.update(for: session.user)
        }
        .onDisappear {
            flowsStore.stop()
            projectsStore.stop()
            tenantStore.stop()
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
        .onChange(of: projectsStore.projects.map(\.id)) { _, _ in
            // Removed auto-selection of first project to allow All Projects as default or chosen state
        }
        .onChange(of: selectedProjectId) { _, projectId in
            guard let tenantId = tenantStore.activeTenantId else {
                flowsStore.stop()
                return
            }

            flowsStore.start(tenantId: tenantId, projectId: projectId)
        }
    }
    
    private var pipelineTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: PFSpacing.md) {
                ForEach(FlowType.allCases) { type in
                    Button {
                        selectedType = type
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: type.icon)
                                .font(.caption)
                            Text(type.rawValue)
                                .font(.subheadline.weight(.medium))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(selectedType == type ? colors.primary : colors.surfaceCard)
                        .foregroundStyle(selectedType == type ? .white : colors.textMain)
                        .clipShape(Capsule())
                        .shadow(color: colors.shadowSm, radius: 2, x: 0, y: 1)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, PFSpacing.lg)
            .padding(.vertical, PFSpacing.md)
        }
        .background(colors.surfaceBg)
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: PFSpacing.lg) {
            projectPicker
            loadingSection
            errorSection
            listSection
        }
        .padding(PFSpacing.lg)
    }

    @ViewBuilder
    private var loadingSection: some View {
        if flowsStore.isLoading || tenantStore.isLoading {
            ProgressView()
                .frame(maxWidth: .infinity)
        }
    }

    @ViewBuilder
    private var errorSection: some View {
        if let error = flowsStore.errorMessage {
            Text(error)
                .font(.footnote)
                .foregroundStyle(colors.error)
        }
    }

    @ViewBuilder
    private var listSection: some View {
        let label = selectedProject?.title ?? "All Projects"
        if filteredFlows.isEmpty && !flowsStore.isLoading {
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.sm) {
                    Text(searchText.isEmpty ? "No \(selectedType.rawValue) flows in \(label) yet." : "No matches found.")
                        .font(.headline)
                        .foregroundStyle(colors.textMain)
                    Text(searchText.isEmpty ? "Create a flow to capture strategy and next steps." : "Try adjusting your search or filters.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                }
            }
        } else {
            VStack(spacing: PFSpacing.md) {
                ForEach(filteredFlows) { flow in
                    NavigationLink(destination: FlowDetailView(
                        flow: flow,
                        tenantId: tenantStore.activeTenantId ?? "",
                        permissions: tenantStore.permissionContext(projectOwnerId: projectsStore.projects.first(where: { $0.id == flow.projectId })?.ownerId)
                    )) {
                        flowRow(flow)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var projectPicker: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.xs) {
                Text("Project Filter")
                    .font(.caption)
                    .foregroundStyle(colors.textMuted)

                Picker("Project", selection: $selectedProjectId) {
                    Text("All Projects").tag(String?.none)
                    ForEach(projectsStore.projects) { project in
                        Text(project.title).tag(String?.some(project.id))
                    }
                }
                .pickerStyle(.menu)
            }
        }
    }

    private func flowRow(_ flow: Flow) -> some View {
        PFCard {
            HStack(alignment: .top, spacing: PFSpacing.md) {
                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    Text(flow.title)
                        .font(.headline)
                        .foregroundStyle(colors.textMain)

                    if !flow.description.isEmpty {
                        Text(flow.description)
                            .font(.subheadline)
                            .foregroundStyle(colors.textMuted)
                            .lineLimit(2)
                    }

                    Text("\(FlowLocalization.type(flow.type)) • \(FlowLocalization.stage(flow.stage))")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)
                }

                Spacer()

                Menu {
                    Button("Edit") {
                        beginEdit(flow)
                    }

                    Button("Delete", role: .destructive) {
                        deletingFlow = flow
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

    private func beginCreate() {
        editingFlow = nil
        draftTitle = ""
        draftDescription = ""
        draftType = selectedType.rawValue
        draftStage = "Brainstorm"
        showingEditor = true
    }

    private func beginEdit(_ flow: Flow) {
        editingFlow = flow
        draftTitle = flow.title
        draftDescription = flow.description
        draftType = flow.type
        draftStage = flow.stage
        showingEditor = true
    }

    private func saveFlow() async {
        guard let tenantId = selectedTenantId, let projectId = selectedProjectId else { return }
        let permissions = tenantStore.permissionContext(projectOwnerId: selectedProject?.ownerId)

        if let flow = editingFlow {
            await flowsStore.updateFlow(
                tenantId: tenantId,
                projectId: projectId,
                flowId: flow.id,
                title: draftTitle,
                description: draftDescription,
                type: draftType,
                stage: draftStage,
                permissions: permissions
            )
        } else {
            await flowsStore.createFlow(
                tenantId: tenantId,
                projectId: projectId,
                title: draftTitle,
                description: draftDescription,
                type: draftType,
                stage: draftStage,
                permissions: permissions
            )
        }

        if flowsStore.errorMessage == nil {
            showingEditor = false
        }
    }

    private func deleteFlow(_ flow: Flow) async {
        guard let tenantId = selectedTenantId, let projectId = selectedProjectId else { return }
        let permissions = tenantStore.permissionContext(projectOwnerId: selectedProject?.ownerId)
        await flowsStore.deleteFlow(
            tenantId: tenantId,
            projectId: projectId,
            flowId: flow.id,
            permissions: permissions
        )
    }
}

struct FlowBoardView: View {
    let flows: [Flow]
    let tenantId: String
    @ObservedObject var projectsStore: ProjectsStore
    @ObservedObject var tenantStore: TenantStore
    let onEdit: (Flow) -> Void
    let onDelete: (Flow) -> Void
    
    @Environment(\.colorScheme) private var colorScheme
    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    
    private let stages = ["Brainstorm", "Refining", "Concept", "Review", "Approved"]
    
    var body: some View {
        TabView {
            ForEach(stages, id: \.self) { stage in
                boardColumn(stage: stage)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: .always))
        .indexViewStyle(.page(backgroundDisplayMode: .always))
    }
    
    private func boardColumn(stage: String) -> some View {
        let columnFlows = flows.filter { $0.stage == stage }
        
        return VStack(alignment: .leading, spacing: PFSpacing.md) {
            HStack {
                Text(FlowLocalization.stage(stage).uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundStyle(colors.textMuted)
                    .tracking(1)
                
                Spacer()
                
                Text("\(columnFlows.count)")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(colors.textSubtle)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(colors.surfaceHover)
                    .clipShape(Capsule())
            }
            .padding(.horizontal, PFSpacing.lg)
            .padding(.top, PFSpacing.md)
            
            ScrollView {
                VStack(spacing: PFSpacing.md) {
                    if columnFlows.isEmpty {
                        Text("No items")
                            .font(.subheadline)
                            .foregroundStyle(colors.textSubtle)
                            .padding(.top, 40)
                    } else {
                        ForEach(columnFlows) { flow in
                            let project = projectsStore.projects.first(where: { $0.id == flow.projectId })
                            let permissions = tenantStore.permissionContext(projectOwnerId: project?.ownerId)
                            
                            NavigationLink(destination: FlowDetailView(
                                flow: flow,
                                tenantId: tenantId,
                                permissions: permissions
                            )) {
                                boardCard(flow: flow, project: project)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(PFSpacing.lg)
            }
        }
    }
    
    private func boardCard(flow: Flow, project: Project?) -> some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.sm) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(flow.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(colors.textMain)
                            .lineLimit(2)
                        
                        if let project = project {
                            Text(project.title)
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(colors.primary)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(colors.primary.opacity(0.1))
                                .cornerRadius(4)
                        }
                    }
                    
                    Spacer()
                    
                    Menu {
                        Button("Edit") { onEdit(flow) }
                        Button("Delete", role: .destructive) { onDelete(flow) }
                    } label: {
                        Image(systemName: "ellipsis")
                            .font(.caption)
                            .foregroundStyle(colors.textMuted)
                    }
                }
                
                if !flow.description.isEmpty {
                    Text(flow.description)
                        .font(.caption)
                        .foregroundStyle(colors.textSubtle)
                        .lineLimit(3)
                }
            }
        }
    }
}

private struct FlowEditorView: View {
    @Environment(\.colorScheme) private var colorScheme
    let isEditing: Bool
    @Binding var title: String
    @Binding var description: String
    @Binding var type: String
    @Binding var stage: String
    let onSave: () async -> Void
    let onCancel: () -> Void

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private let types = ["Feature", "Product", "Optimization", "Marketing", "Moonshot"]
    private let stages = ["Brainstorm", "Refining", "Concept", "Review", "Approved"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                Text(isEditing ? "Edit Flow" : "New Flow")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(colors.textMain)

                PFInputField(
                    title: "Title",
                    placeholder: "Flow title",
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
                    Text("Type")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)

                    Picker("Type", selection: $type) {
                        ForEach(types, id: \.self) { value in
                            Text(value).tag(value)
                        }
                    }
                    .pickerStyle(.menu)
                }

                VStack(alignment: .leading, spacing: PFSpacing.xs) {
                    Text("Stage")
                        .font(.caption)
                        .foregroundStyle(colors.textMuted)

                    Picker("Stage", selection: $stage) {
                        ForEach(stages, id: \.self) { value in
                            Text(value).tag(value)
                        }
                    }
                    .pickerStyle(.menu)
                }

                PFPrimaryButton(title: isEditing ? "Save Changes" : "Create Flow") {
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
