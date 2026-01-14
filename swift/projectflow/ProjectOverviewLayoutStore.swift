import Foundation
import Combine
import FirebaseFirestore

@MainActor
final class ProjectOverviewLayoutStore: ObservableObject {
    @Published var layout: ProjectOverviewLayout = .defaultLayout
    @Published var isLoading = false
    @Published var isSaving = false
    @Published var saveError: String?

    private let db = Firestore.firestore()
    private let repository = ProjectRepository()
    private var listener: ListenerRegistration?

    func start(tenantId: String, projectId: String) {
        isLoading = true
        listener?.remove()

        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.projects)
            .document(projectId)

        listener = ref.addSnapshotListener { [weak self] snapshot, _ in
            guard let self else { return }
            let data = snapshot?.data() ?? [:]
            if let raw = data["overviewLayout"] as? [String: Any] {
                layout = ProjectOverviewLayout.from(data: raw)
            } else {
                layout = ProjectOverviewLayout.defaultLayout
            }
            isLoading = false
        }
    }

    func stop() {
        listener?.remove()
        listener = nil
        isLoading = false
    }

    func markCustom() {
        if layout.templateId != ProjectOverviewTemplateId.custom {
            layout.templateId = ProjectOverviewTemplateId.custom
        }
    }

    func resetToDefault() {
        layout = ProjectOverviewLayout.defaultLayout
    }

    func saveLayout(tenantId: String, projectId: String, permissions: PermissionContext) async {
        isSaving = true
        saveError = nil
        do {
            try await repository.updateProject(
                tenantId: tenantId,
                projectId: projectId,
                updates: ["overviewLayout": layout.data],
                permissions: permissions
            )
        } catch {
            saveError = error.localizedDescription
        }
        isSaving = false
    }
}
