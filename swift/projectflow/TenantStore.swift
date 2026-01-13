import Foundation
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class TenantStore: ObservableObject {
    @Published var activeTenantId: String?
    @Published var membership: TenantMembership?
    @Published var isLoading = false

    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?
    private var currentUserId: String?

    func update(for user: User?) {
        listener?.remove()
        membership = nil
        currentUserId = user?.uid

        guard let user else {
            activeTenantId = nil
            isLoading = false
            return
        }

        guard let tenantId = TenantResolver.resolveTenantId(for: user) else {
            activeTenantId = nil
            isLoading = false
            return
        }

        activeTenantId = tenantId
        isLoading = true

        let ref = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.members)
            .document(user.uid)

        listener = ref.addSnapshotListener { [weak self] snapshot, _ in
            guard let self else { return }
            if let snapshot, snapshot.exists {
                membership = TenantMembership(id: snapshot.documentID, data: snapshot.data() ?? [:])
            } else {
                membership = nil
            }
            isLoading = false
        }
    }

    func stop() {
        listener?.remove()
        listener = nil
    }

    func permissionContext(projectOwnerId: String? = nil) -> PermissionContext {
        let role = membership?.role ?? "Member"
        let isTenantOwner = role == "Owner" || (activeTenantId != nil && activeTenantId == currentUserId)
        let isProjectOwner = projectOwnerId == currentUserId
        return PermissionContext(
            isTenantOwner: isTenantOwner,
            isProjectOwner: isProjectOwner,
            allow: [],
            deny: [],
            canCreateProjects: canCreateProjects(role: role)
        )
    }

    private func canCreateProjects(role: String) -> Bool {
        switch role {
        case "Owner", "Admin", "Member":
            return true
        default:
            return false
        }
    }
}
