import Foundation
import FirebaseFirestore

// Flows (`brain/plans/flows-concept.md`): `tenants/{t}/automations` (read by role), runs in `automation_runs`.
// iOS reads, toggles, runs now and retries; creating/editing stays on the web (`saveAutomation` validates the builder).

public struct FlowItem: Identifiable, Hashable, Sendable {
    public let id: String
    public let name: String
    public let scope: String
    public let projectId: String?
    public let enabled: Bool
    public let triggerType: String
    public let actionTypes: [String]
    public let needsTask: Bool
    public let pausedReason: String?
    public let lastRunAt: Date?
    public let lastStatus: String?
    public let consecutiveFailures: Int

    init(id: String, data: [String: Any]) {
        self.id = id
        name = data["name"] as? String ?? ""
        scope = data["scope"] as? String ?? "workspace"
        projectId = data["projectId"] as? String
        enabled = data["enabled"] as? Bool ?? false
        triggerType = (data["trigger"] as? [String: Any])?["type"] as? String ?? "manual"
        let actions = data["actions"] as? [[String: Any]] ?? []
        actionTypes = actions.compactMap { $0["type"] as? String }
        // Same rule as the server (`TASK_ACTIONS`): these need a task when run by hand.
        let taskActions: Set<String> = ["set_field", "assign", "set_status", "comment", "add_label", "remove_label", "move", "ai"]
        needsTask = actions.contains { action in
            taskActions.contains(action["type"] as? String ?? "") || ((action["config"] as? [String: Any])?["asSubtask"] as? Bool == true)
        }
        pausedReason = data["pausedReason"] as? String
        let stats = data["stats"] as? [String: Any] ?? [:]
        lastRunAt = (stats["lastRunAt"] as? Timestamp)?.dateValue()
        lastStatus = stats["lastStatus"] as? String
        consecutiveFailures = (stats["consecutiveFailures"] as? NSNumber)?.intValue ?? 0
    }
}

public struct FlowRun: Identifiable, Hashable, Sendable {
    public struct Step: Hashable, Sendable {
        public let actionId: String
        public let status: String
        public let error: String?
    }
    public let id: String
    public let status: String
    public let startedAt: Date?
    public let finishedAt: Date?
    public let taskId: String?
    public let projectId: String?
    public let steps: [Step]
    public let skipReason: String?
    public let error: String?

    init(id: String, data: [String: Any]) {
        self.id = id
        status = data["status"] as? String ?? "running"
        startedAt = (data["startedAt"] as? Timestamp)?.dateValue()
        finishedAt = (data["finishedAt"] as? Timestamp)?.dateValue()
        let entity = data["entity"] as? [String: Any] ?? [:]
        taskId = entity["taskId"] as? String ?? (entity["type"] as? String == "task" ? entity["id"] as? String : nil)
        projectId = entity["projectId"] as? String
        steps = (data["steps"] as? [[String: Any]] ?? []).map {
            Step(actionId: $0["actionId"] as? String ?? "", status: $0["status"] as? String ?? "", error: $0["error"] as? String)
        }
        skipReason = data["skipReason"] as? String
        error = data["error"] as? String
    }
}

@Observable
public final class FlowsStore {
    public let tenantId: String
    public private(set) var flows: [FlowItem] = []
    public private(set) var isLoaded = false
    public private(set) var failed = false
    private var registration: ListenerRegistration?

    public init(tenantId: String) { self.tenantId = tenantId }

    public func start() {
        guard registration == nil else { return }
        registration = PFFirebase.db.collection("tenants").document(tenantId).collection("automations").addSnapshotListener { [weak self] snapshot, error in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.isLoaded = true
                self.failed = snapshot == nil && error != nil
                self.flows = snapshot?.documents.map { FlowItem(id: $0.documentID, data: $0.data()) }
                    .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending } ?? self.flows
            }
        }
    }

    public func stop() { registration?.remove(); registration = nil }
}

public enum FlowsData {
    public static func setEnabled(tenantId: String, id: String, enabled: Bool) async throws {
        _ = try await PFCallables.call("setAutomationEnabled", ["tenantId": tenantId, "id": id, "enabled": enabled])
    }

    /// Runs the flow now; returns the run status (`succeeded`, `failed`, `waiting`, …).
    public static func run(tenantId: String, id: String, projectId: String?, taskId: String?) async throws -> String {
        var data: [String: Any] = ["tenantId": tenantId, "id": id]
        if let projectId { data["projectId"] = projectId }
        if let taskId { data["taskId"] = taskId }
        let result = try await PFCallables.call("runAutomation", data) as? [String: Any]
        return result?["status"] as? String ?? "running"
    }

    public static func retry(tenantId: String, runId: String) async throws {
        _ = try await PFCallables.call("retryAutomationRun", ["tenantId": tenantId, "runId": runId])
    }

    public static func runs(tenantId: String, flowId: String) async -> [FlowRun]? {
        let snap = try? await PFFirebase.db.collection("tenants").document(tenantId).collection("automation_runs")
            .whereField("automationId", isEqualTo: flowId).order(by: "startedAt", descending: true).limit(to: 50).getDocuments()
        return snap?.documents.map { FlowRun(id: $0.documentID, data: $0.data()) }
    }
}
