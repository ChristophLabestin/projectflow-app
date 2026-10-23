import Foundation
import FirebaseFirestore

/// `tenants/{tenantId}/entitlements/plan` (billing contract `brain/plans/billing-entitlements-contract.md`). Read-only on
/// clients. A missing document means an existing workspace in grace: Team with AI for everyone and no limits.
public struct PlanEntitlements: Equatable, Sendable {
    public enum Plan: String, Sendable { case free, personal, team, organization }
    public enum Status: String, Sendable { case trialing, active, pastDue = "past_due", grace, free, canceled, exempt }

    public var plan: Plan = .team
    public var status: Status = .grace
    public var trialEndsAt: Date?
    public var graceEndsAt: Date?
    public var currentPeriodEnd: Date?
    public var cancelAtPeriodEnd = false
    public var memberLimit: Int?
    public var projectLimit: Int?
    public var projectCount = 0
    public var lockedProjectIds: Set<String> = []
    public var invitesAllowed = true
    public var aiIncluded = true
    public var aiAddonAvailable = false
    public var aiMemberIds: Set<String> = []
    public var isPersonalWorkspace = false
    public var storageQuotaBytes: Int64?
    /// No entitlements document yet (legacy workspace in grace).
    public var isLegacy = true

    public init() {}

    public init(data: [String: Any]) {
        isLegacy = false
        plan = Plan(rawValue: data["plan"] as? String ?? "") ?? .free
        status = Status(rawValue: data["status"] as? String ?? "") ?? .free
        trialEndsAt = (data["trialEndsAt"] as? Timestamp)?.dateValue()
        graceEndsAt = (data["graceEndsAt"] as? Timestamp)?.dateValue()
        currentPeriodEnd = (data["currentPeriodEnd"] as? Timestamp)?.dateValue()
        cancelAtPeriodEnd = data["cancelAtPeriodEnd"] as? Bool ?? false
        memberLimit = (data["memberLimit"] as? NSNumber)?.intValue
        projectLimit = (data["projectLimit"] as? NSNumber)?.intValue
        projectCount = (data["projectCount"] as? NSNumber)?.intValue ?? 0
        lockedProjectIds = Set(data["lockedProjectIds"] as? [String] ?? [])
        invitesAllowed = data["invitesAllowed"] as? Bool ?? false
        aiIncluded = data["aiIncluded"] as? Bool ?? false
        aiAddonAvailable = data["aiAddonAvailable"] as? Bool ?? false
        aiMemberIds = Set(data["aiMemberIds"] as? [String] ?? [])
        isPersonalWorkspace = (data["workspaceType"] as? String) == "personal"
        storageQuotaBytes = (data["storageQuotaBytes"] as? NSNumber)?.int64Value
    }

    /// Server AI for this user (`aiEnabledFor`): included in the plan, or an assigned AI add-on seat.
    public func aiEnabled(for uid: String?) -> Bool {
        if aiIncluded { return true }
        guard aiAddonAvailable, let uid else { return false }
        return aiMemberIds.contains(uid)
    }

    public var canInvite: Bool { invitesAllowed && !isPersonalWorkspace }

    public var canCreateProject: Bool {
        guard let projectLimit else { return true }
        return projectCount < projectLimit
    }

    public func isLocked(projectId: String) -> Bool { lockedProjectIds.contains(projectId) }
}

/// Live entitlements of the active workspace.
@Observable
public final class PlanStore {
    public private(set) var entitlements = PlanEntitlements()
    public private(set) var isLoaded = false
    public let tenantId: String
    private var registration: ListenerRegistration?

    public init(tenantId: String) { self.tenantId = tenantId }

    public func start() {
        guard registration == nil else { return }
        registration = PFFirebase.db.collection("tenants").document(tenantId).collection("entitlements").document("plan")
            .addSnapshotListener { [weak self] snapshot, _ in
                MainActor.assumeIsolated {
                    guard let self else { return }
                    if let data = snapshot?.data() {
                        self.entitlements = PlanEntitlements(data: data)
                    } else if snapshot != nil {
                        self.entitlements = PlanEntitlements()
                    }
                    self.isLoaded = snapshot != nil || self.isLoaded
                }
            }
    }

    public func stop() {
        registration?.remove()
        registration = nil
    }
}

/// Plan error codes from callables and REST (billing contract §3). Callable errors carry the code in `message`.
public enum PlanErrorCode {
    public static let all: [String] = [
        "plan-project-limit", "plan-project-locked", "plan-invites-disabled", "plan-member-limit", "plan-workspace-type-mismatch",
        "personal-not-transferable", "ai-not-enabled", "ai-addon-required", "ai-plan-required", "ai-addon-unavailable",
        "ai-addon-needs-subscription", "ai-addon-invalid-member", "billing-not-configured", "billing-already-subscribed",
        "billing-price-missing", "billing-no-customer", "invalid-openai-key", "ai-key-storage-unavailable",
    ]

    /// The plan code inside an error (callable message, `details.code`/`details.reason`), if any.
    public static func code(in error: Error) -> String? {
        let ns = error as NSError
        var texts = [ns.localizedDescription]
        if let details = ns.userInfo["FIRFunctionsErrorDetailsKey"] as? [String: Any] {
            texts += [details["code"], details["reason"]].compactMap { $0 as? String }
        }
        for text in texts {
            if let match = all.first(where: { text == $0 || text.contains($0) }) { return match }
        }
        return nil
    }
}
