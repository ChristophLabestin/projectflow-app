import Foundation
import Observation
import FirebaseAuth
import FirebaseFirestore
import PFModel

/// Signed-in session: the user profile (live), workspace memberships and the active workspace.
/// Mirrors `resolveWorkspaceForCurrentUser` in `web/services/domain/workspacesService.ts`:
/// memberships are discovered from `members` docs (never from a cached id alone — see GOTCHAS
/// "Native tenant bootstrap"); an account without an owned workspace gets one created.
@Observable
public final class SessionStore {
    public struct WorkspaceSummary: Identifiable, Hashable, Sendable {
        public let id: String
        public let name: String
        public let role: WorkspaceRole
        public let ownerId: String?
        /// The user's own workspace (`personal_{uid}`, `workspaceType: 'personal'`, billing contract §7): one member,
        /// no invites, shown as "Persönlich" above the team workspaces.
        public var isPersonal = false
    }

    public enum State: Equatable {
        case idle, loading, ready, failed(String)
    }

    public let uid: String
    public private(set) var profile: UserProfile?
    public private(set) var workspaces: [WorkspaceSummary] = []
    public private(set) var activeWorkspaceId: String?
    /// Workspaces the platform suspended (`tenants/{id}.suspendedAt`, admin console). Kept live per tenant doc;
    /// members may still read the tenant doc, every other tenant-scoped read is denied by the rules.
    public private(set) var suspendedWorkspaceIds: Set<String> = []
    public private(set) var state: State = .idle
    /// `users/{uid}/private/onboarding.welcomePending`: the first-sign-in onboarding is still open (shared with web).
    public private(set) var welcomePending = false
    /// `onboarding.survey.useCases` (shared survey, web + iOS); drives the suggested project template.
    public private(set) var surveyUseCases: [String] = []
    /// The account has an onboarding doc (created after the onboarding rework): it may see the getting-started checklist.
    public private(set) var hasOnboarding = false
    /// `checklistDismissed`: the user hid the getting-started checklist (shared with the web dashboard card).
    public private(set) var checklistDismissed = false
    private let listeners = ListenerBag()
    private var language = "de"
    private let defaults: UserDefaults

    public init(uid: String, defaults: UserDefaults = UserDefaults(suiteName: "group.de.christophlabestin.projectflow") ?? .standard) {
        self.uid = uid
        self.defaults = defaults
    }

    public var activeWorkspace: WorkspaceSummary? { workspaces.first { $0.id == activeWorkspaceId } }
    public var role: WorkspaceRole { activeWorkspace?.role ?? .member }
    public var isActiveSuspended: Bool { activeWorkspaceId.map(suspendedWorkspaceIds.contains) ?? false }

    public func start(defaultWorkspaceName: String, language: String = "de") async {
        self.language = language
        guard state != .loading else { return }
        state = .loading
        listenProfile()
        listenOnboarding()
        do {
            try await ensureUserProfile()
            try await loadWorkspaces(defaultWorkspaceName: defaultWorkspaceName)
            listenSuspensions()
            state = .ready
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    public func stop() { listeners.removeAll() }

    public func reloadWorkspaces() async {
        try? await loadWorkspaces(defaultWorkspaceName: nil)
        listenSuspensions()
    }

    /// One listener per workspace tenant doc, so a suspension or release applies live.
    private func listenSuspensions() {
        let ids = Set(workspaces.map(\.id))
        suspendedWorkspaceIds.formIntersection(ids)
        for id in ids {
            let registration = PFFirebase.db.collection("tenants").document(id).addSnapshotListener { [weak self] snapshot, _ in
                MainActor.assumeIsolated {
                    guard let self, let snapshot else { return }
                    if snapshot.data()?["suspendedAt"].map({ !($0 is NSNull) }) == true {
                        self.suspendedWorkspaceIds.insert(id)
                    } else {
                        self.suspendedWorkspaceIds.remove(id)
                    }
                }
            }
            listeners.set("tenant.\(id)", registration)
        }
    }

    public func switchWorkspace(to id: String) {
        guard workspaces.contains(where: { $0.id == id }), id != activeWorkspaceId else { return }
        activeWorkspaceId = id
        defaults.set(id, forKey: cacheKey)
    }

    private var cacheKey: String { "pf.activeTenant.\(uid)" }

    private func listenProfile() {
        let registration = PFPath.user(uid).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot, let fields = snapshot.fields else { return }
                self.profile = UserProfile(id: snapshot.documentID, fields: fields)
            }
        }
        listeners.set("profile", registration)
    }

    private static func onboardingDoc(_ uid: String) -> DocumentReference {
        PFPath.user(uid).collection("private").document("onboarding")
    }

    private func listenOnboarding() {
        let registration = Self.onboardingDoc(uid).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.welcomePending = (snapshot?.data()?["welcomePending"] as? Bool) == true
                self.surveyUseCases = ((snapshot?.data()?["survey"] as? [String: Any])?["useCases"] as? [String]) ?? []
                self.hasOnboarding = snapshot?.exists == true
                self.checklistDismissed = (snapshot?.data()?["checklistDismissed"] as? Bool) == true
            }
        }
        listeners.set("onboarding", registration)
    }

    /// Stores the onboarding survey once (all fields optional; skipped answers stay absent). Shared contract with web.
    public func saveSurvey(role: String?, useCases: [String], teamSize: String?, industry: String?, source: String?, previousTool: String?) async {
        var survey: [String: Any] = ["platform": "ios", "answeredAt": FieldValue.serverTimestamp()]
        if let role { survey["role"] = role }
        if !useCases.isEmpty { survey["useCases"] = useCases }
        if let teamSize { survey["teamSize"] = teamSize }
        if let industry { survey["industry"] = industry }
        if let source { survey["source"] = source }
        if let previousTool { survey["previousTool"] = previousTool }
        surveyUseCases = useCases
        try? await Self.onboardingDoc(uid).setData(["survey": survey, "updatedAt": FieldValue.serverTimestamp()], merge: true)
    }

    /// Hides the getting-started checklist everywhere (web `update({ checklistDismissed: true })`).
    public func dismissChecklist() async {
        checklistDismissed = true
        try? await Self.onboardingDoc(uid).setData(["checklistDismissed": true, "updatedAt": FieldValue.serverTimestamp()], merge: true)
    }

    /// Ends the onboarding for good on every platform (web `update({ welcomePending: false })`).
    public func finishWelcome() async {
        welcomePending = false
        try? await Self.onboardingDoc(uid).setData(["welcomePending": false, "updatedAt": FieldValue.serverTimestamp()], merge: true)
    }

    /// Same as web `ensureTenantAndUser`: make sure `users/{uid}` exists with basic profile fields.
    private func ensureUserProfile() async throws {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        let ref = PFPath.user(uid)
        let existing = try? await ref.getDocument()
        let data = existing?.data()
        var update: [String: Any] = [
            "uid": uid,
            "email": (user.email ?? "").lowercased(),
            "displayName": user.displayName ?? (data?["displayName"] as? String) ?? (user.email ?? "User").components(separatedBy: "@").first ?? "User",
            "photoURL": (data?["photoURL"] as? String) ?? user.photoURL?.absoluteString ?? "",
            "updatedAt": FieldValue.serverTimestamp(),
        ]
        if data == nil { update["createdAt"] = FieldValue.serverTimestamp() }
        try await ref.setData(update, merge: true)
    }

    private func loadWorkspaces(defaultWorkspaceName: String?) async throws {
        var summaries = try await fetchWorkspaces()
        if defaultWorkspaceName != nil {
            // Billing contract §7: the server owns the personal workspace (idempotent, called after every sign-in).
            // No client-side fallback: a workspace without `entitlements/plan` would count as Free without AI.
            var created = false
            do {
                let result = try await PFCallables.call("ensurePersonalWorkspace", ["language": language]) as? [String: Any]
                created = result?["created"] as? Bool == true
            } catch {
                // Offline or backend hiccup: carry on with the existing workspaces; none at all fails below (noWorkspace).
                if summaries.isEmpty { throw error }
            }
            if created {
                try? await Self.onboardingDoc(uid).setData(
                    ["welcomePending": true, "checklistDismissed": false, "updatedAt": FieldValue.serverTimestamp()], merge: true)
                summaries = try await fetchWorkspaces()
            }
        }
        workspaces = summaries
        let ids = Set(summaries.map(\.id))
        let cached = defaults.string(forKey: cacheKey)
        let active = cached.flatMap { ids.contains($0) ? $0 : nil }
            ?? summaries.first(where: { $0.isPersonal })?.id
            ?? summaries.first(where: { $0.role == .owner })?.id
            ?? summaries.first?.id
        guard let active else { throw PFDataError.noWorkspace }
        activeWorkspaceId = active
        defaults.set(active, forKey: cacheKey)
    }

    private func fetchWorkspaces() async throws -> [WorkspaceSummary] {
        let memberships = try await PFFirebase.db.collectionGroup("members").whereField("uid", isEqualTo: uid).getDocuments()
        var result: [WorkspaceSummary] = []
        for doc in memberships.documents {
            guard let tenantRef = doc.reference.parent.parent, tenantRef.parent.collectionID == "tenants" else { continue }
            guard let snapshot = try? await tenantRef.getDocument(), let fields = snapshot.fields else { continue }
            let roleRaw = doc.data()["role"] as? String
            let workspace = Workspace(id: tenantRef.documentID, fields: fields)
            let role: WorkspaceRole = workspace.ownerId == uid ? .owner : WorkspaceRole(raw: roleRaw)
            let isPersonal = (snapshot.data()?["workspaceType"] as? String) == "personal" || tenantRef.documentID == "personal_\(uid)"
            result.append(WorkspaceSummary(id: tenantRef.documentID, name: workspace.name, role: role, ownerId: workspace.ownerId,
                                           isPersonal: isPersonal))
        }
        // Personal first, then the teams by name.
        return result.sorted {
            if $0.isPersonal != $1.isPersonal { return $0.isPersonal }
            return $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
        }
    }

    /// New team workspace through the server (billing contract §8): tenant, owner membership and the 14-day trial
    /// plan are written atomically, so there is never a workspace without `entitlements/plan`.
    @discardableResult
    public func createWorkspace(name: String) async throws -> String {
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        let result = try await PFCallables.call("createTeamWorkspace", ["name": trimmed.isEmpty ? "Workspace" : trimmed, "language": language])
        guard let tenantId = (result as? [String: Any])?["tenantId"] as? String else { throw PFDataError.noWorkspace }
        return tenantId
    }
}
