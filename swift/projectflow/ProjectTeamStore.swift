import Foundation
import FirebaseFirestore
import Combine

struct PresenceSnapshot: Equatable {
    let uid: String
    let state: String
    let lastChanged: Date?

    var isOnline: Bool { state == "online" }
    var isIdle: Bool { state == "idle" }
    var isBusy: Bool { state == "busy" }
}

@MainActor
final class ProjectTeamStore: ObservableObject {
    @Published var profilesById: [String: UserProfile] = [:]
    @Published var presenceById: [String: PresenceSnapshot] = [:]
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let db = Firestore.firestore()
    private var presenceListener: ListenerRegistration?
    private var inFlightProfileIds = Set<String>()
    private var activeTenantId: String?

    func start(tenantId: String) {
        guard activeTenantId != tenantId else { return }
        stop()
        activeTenantId = tenantId
        subscribePresence(tenantId: tenantId)
    }

    func stop() {
        presenceListener?.remove()
        presenceListener = nil
        inFlightProfileIds.removeAll()
        activeTenantId = nil
        presenceById = [:]
        errorMessage = nil
    }

    func ensureProfiles(for userIds: [String]) {
        let uniqueIds = Set(userIds).filter { !$0.isEmpty }
        let missing = uniqueIds.subtracting(profilesById.keys).subtracting(inFlightProfileIds)
        guard !missing.isEmpty else { return }

        inFlightProfileIds.formUnion(missing)
        _Concurrency.Task { [weak self] in
            await self?.fetchProfiles(ids: Array(missing))
        }
    }

    private func subscribePresence(tenantId: String) {
        presenceListener = db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.presence)
            .addSnapshotListener { [weak self] snapshot, error in
                guard let self else { return }
                if let error {
                    errorMessage = error.localizedDescription
                    presenceById = [:]
                    return
                }

                let now = Date()
                let timeout: TimeInterval = 2 * 60
                var nextPresence: [String: PresenceSnapshot] = [:]

                for document in snapshot?.documents ?? [] {
                    let data = document.data()
                    let state = data["state"] as? String ?? "offline"
                    guard state == "online" || state == "idle" || state == "busy" else { continue }
                    let lastChanged = (data["lastChanged"] as? Timestamp)?.dateValue()
                    if let lastChanged, now.timeIntervalSince(lastChanged) > timeout {
                        continue
                    }
                    let uid = data["uid"] as? String ?? document.documentID
                    nextPresence[uid] = PresenceSnapshot(uid: uid, state: state, lastChanged: lastChanged)
                }

                presenceById = nextPresence
            }
    }

    private func fetchProfiles(ids: [String]) async {
        defer {
            ids.forEach { inFlightProfileIds.remove($0) }
        }

        let batches = ids.chunked(into: 10)
        for batch in batches {
            do {
                let snapshot = try await getDocuments(
                    from: db.collection(FirestorePath.users)
                        .whereField(FieldPath.documentID(), in: batch)
                )
                for document in snapshot.documents {
                    profilesById[document.documentID] = UserProfile(id: document.documentID, data: document.data())
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }

    private func getDocuments(from query: Query) async throws -> QuerySnapshot {
        try await withCheckedThrowingContinuation { continuation in
            query.getDocuments { snapshot, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let snapshot {
                    continuation.resume(returning: snapshot)
                } else {
                    continuation.resume(throwing: FirestoreError.missingSnapshot)
                }
            }
        }
    }
}

private extension Array {
    func chunked(into size: Int) -> [[Element]] {
        guard size > 0 else { return [self] }
        var result: [[Element]] = []
        var index = 0
        while index < count {
            let end = Swift.min(index + size, count)
            result.append(Array(self[index..<end]))
            index += size
        }
        return result
    }
}
