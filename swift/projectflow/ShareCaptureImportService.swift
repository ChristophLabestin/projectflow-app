import Foundation
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class ShareCaptureImportService {
    static let shared = ShareCaptureImportService()

    private let db = Firestore.firestore()
    private var isImporting = false

    private init() {}

    func importPendingCaptures() {
        guard !isImporting else { return }
        guard let user = Auth.auth().currentUser else { return }
        guard let tenantId = TenantResolver.resolveTenantId(for: user) else { return }

        let captures = ProjectFlowShareCaptureQueue.drain()
        guard !captures.isEmpty else { return }

        isImporting = true
        Task {
            var failed: [ProjectFlowShareCapture] = []

            for capture in captures {
                do {
                    try await createPersonalTask(from: capture, userId: user.uid, tenantId: tenantId)
                } catch {
                    failed.append(capture)
                    print("Failed to import shared ProjectFlow capture: \(error.localizedDescription)")
                }
            }

            if !failed.isEmpty {
                ProjectFlowShareCaptureQueue.replace(failed)
            }
            isImporting = false
        }
    }

    private func createPersonalTask(from capture: ProjectFlowShareCapture, userId: String, tenantId: String) async throws {
        var taskData: [String: Any] = [
            "ownerId": userId,
            "title": capture.title,
            "description": capture.text,
            "isCompleted": false,
            "priority": "Medium",
            "createdAt": FieldValue.serverTimestamp(),
            "tenantId": tenantId,
            "source": "ios_share_extension",
            "shareCaptureId": capture.id
        ]

        if let url = capture.url, !url.isEmpty {
            taskData["sourceUrl"] = url
        }

        try await db.collection(FirestorePath.tenants)
            .document(tenantId)
            .collection(FirestorePath.users)
            .document(userId)
            .collection("personalTasks")
            .document(capture.id)
            .setDataAsync(taskData, merge: true)
    }
}

private extension DocumentReference {
    func setDataAsync(_ data: [String: Any], merge: Bool = false) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            setData(data, merge: merge) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: ())
                }
            }
        }
    }
}
