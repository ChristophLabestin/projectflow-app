import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class IssuesStore: ObservableObject {
    @Published var issues: [Issue] = []
    @Published var isLoading = true
    @Published var errorMessage: String?

    private let repository = IssueRepository()
    private var listener: ListenerRegistration?

    func start(tenantId: String, projectId: String) {
        isLoading = true
        errorMessage = nil
        listener?.remove()
        listener = repository.listenIssues(
            tenantId: tenantId,
            projectId: projectId,
            onUpdate: { [weak self] issues in
                self?.issues = issues.sorted { left, right in
                    let leftDate = left.createdAt?.dateValue() ?? Date.distantPast
                    let rightDate = right.createdAt?.dateValue() ?? Date.distantPast
                    return leftDate > rightDate
                }
                self?.isLoading = false
            },
            onError: { [weak self] error in
                self?.errorMessage = error.localizedDescription
                self?.isLoading = false
            }
        )
    }

    func stop() {
        listener?.remove()
        listener = nil
    }

    func createIssue(
        tenantId: String,
        projectId: String,
        title: String,
        description: String,
        status: String,
        priority: String,
        permissions: PermissionContext
    ) async {
        errorMessage = nil
        guard let userId = Auth.auth().currentUser?.uid else {
            errorMessage = "You must be signed in to create an issue."
            return
        }

        var issue = Issue(id: UUID().uuidString, data: [:])
        issue.projectId = projectId
        issue.ownerId = userId
        issue.reporterId = userId
        issue.title = title
        issue.description = description
        issue.status = status
        issue.priority = priority
        issue.assigneeIds = []

        do {
            _ = try await repository.createIssue(tenantId: tenantId, projectId: projectId, issue: issue, permissions: permissions)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func updateIssue(
        tenantId: String,
        projectId: String,
        issueId: String,
        title: String,
        description: String,
        status: String,
        priority: String,
        permissions: PermissionContext
    ) async {
        errorMessage = nil
        let updates: [String: Any] = [
            "title": title,
            "description": description,
            "status": status,
            "priority": priority
        ]

        do {
            try await repository.updateIssue(
                tenantId: tenantId,
                projectId: projectId,
                issueId: issueId,
                updates: updates,
                permissions: permissions
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func deleteIssue(tenantId: String, projectId: String, issueId: String, permissions: PermissionContext) async {
        errorMessage = nil
        do {
            try await repository.deleteIssue(tenantId: tenantId, projectId: projectId, issueId: issueId, permissions: permissions)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
