import SwiftUI

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

    private var colors: PFColors { PFColors.palette(for: colorScheme) }
    private var selectedProject: Project? {
        projectsStore.projects.first { $0.id == selectedProjectId }
    }

    var body: some View {
        AnyView(
            ScrollView {
                content
            }
            .background(colors.surfaceBg.ignoresSafeArea())
            .onAppear {
                tenantStore.update(for: session.user)
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
                if selectedProjectId == nil {
                    selectedProjectId = projectsStore.projects.first?.id
                }
            }
            .onChange(of: selectedProjectId) { _, projectId in
                guard let tenantId = tenantStore.activeTenantId, let projectId else {
                    flowsStore.stop()
                    return
                }
                flowsStore.start(tenantId: tenantId, projectId: projectId)
            }
            .onDisappear {
                flowsStore.stop()
                projectsStore.stop()
                tenantStore.stop()
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
                titleVisibility: .visible
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
        )
    }

    private var content: some View {
        AnyView(
            VStack(alignment: .leading, spacing: PFSpacing.lg) {
                headerSection
                projectPicker
                loadingSection
                errorSection
                listSection
            }
            .padding(PFSpacing.lg)
        )
    }

    private var headerSection: some View {
        HStack {
            Text("Flows")
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
            .disabled(selectedProjectId == nil || flowsStore.isLoading)
        }
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
        if let project = selectedProject, flowsStore.flows.isEmpty && !flowsStore.isLoading {
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.sm) {
                    Text("No flows in \(project.title) yet.")
                        .font(.headline)
                        .foregroundStyle(colors.textMain)
                    Text("Create a flow to capture strategy and next steps.")
                        .font(.subheadline)
                        .foregroundStyle(colors.textMuted)
                }
            }
        } else {
            VStack(spacing: PFSpacing.md) {
                ForEach(flowsStore.flows) { flow in
                    flowRow(flow)
                }
            }
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

                    Text("\(flow.type) • \(flow.stage)")
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
        draftType = "Feature"
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
        guard let tenantId = tenantStore.activeTenantId, let projectId = selectedProjectId else { return }
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
        guard let tenantId = tenantStore.activeTenantId, let projectId = selectedProjectId else { return }
        let permissions = tenantStore.permissionContext(projectOwnerId: selectedProject?.ownerId)
        await flowsStore.deleteFlow(
            tenantId: tenantId,
            projectId: projectId,
            flowId: flow.id,
            permissions: permissions
        )
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
                        .overlay(
                            RoundedRectangle(cornerRadius: PFRadius.md, style: .continuous)
                                .stroke(colors.surfaceBorder, lineWidth: 1)
                        )
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
