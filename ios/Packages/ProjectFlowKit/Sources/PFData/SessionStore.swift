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
    }

    public enum State: Equatable {
        case idle, loading, ready, failed(String)
    }

    public let uid: String
    public private(set) var profile: UserProfile?
    public private(set) var workspaces: [WorkspaceSummary] = []
    public private(set) var activeWorkspaceId: String?
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
    private let defaults: UserDefaults

    public init(uid: String, defaults: UserDefaults = UserDefaults(suiteName: "group.de.christophlabestin.projectflow") ?? .standard) {
        self.uid = uid
        self.defaults = defaults
    }

    public var activeWorkspace: WorkspaceSummary? { workspaces.first { $0.id == activeWorkspaceId } }
    public var role: WorkspaceRole { activeWorkspace?.role ?? .member }

    public func start(defaultWorkspaceName: String) async {
        guard state != .loading else { return }
        state = .loading
        listenProfile()
        listenOnboarding()
        do {
            try await ensureUserProfile()
            try await loadWorkspaces(defaultWorkspaceName: defaultWorkspaceName)
            state = .ready
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    public func stop() { listeners.removeAll() }

    public func reloadWorkspaces() async {
        try? await loadWorkspaces(defaultWorkspaceName: nil)
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
        if let defaultWorkspaceName, !summaries.contains(where: { $0.role == .owner }) {
            _ = try await createWorkspace(name: defaultWorkspaceName)
            try? await Self.onboardingDoc(uid).setData(
                ["welcomePending": true, "checklistDismissed": false, "updatedAt": FieldValue.serverTimestamp()], merge: true)
            summaries = try await fetchWorkspaces()
        }
        workspaces = summaries
        let ids = Set(summaries.map(\.id))
        let cached = defaults.string(forKey: cacheKey)
        let active = cached.flatMap { ids.contains($0) ? $0 : nil }
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
            result.append(WorkspaceSummary(id: tenantRef.documentID, name: workspace.name, role: role, ownerId: workspace.ownerId))
        }
        return result.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    /// Same batch as web `createWorkspace`.
    @discardableResult
    public func createWorkspace(name: String) async throws -> String {
        guard let user = Auth.auth().currentUser else { throw PFDataError.notSignedIn }
        let tenant = PFFirebase.db.collection("tenants").document()
        let batch = PFFirebase.db.batch()
        batch.setData([
            "tenantId": tenant.documentID,
            "name": name.trimmingCharacters(in: .whitespaces).isEmpty ? "Workspace" : name,
            "ownerId": uid, "createdBy": uid,
            "createdAt": FieldValue.serverTimestamp(), "updatedAt": FieldValue.serverTimestamp(),
        ], forDocument: tenant)
        batch.setData([
            "uid": uid, "role": "Owner", "roleIds": [],
            "joinedAt": FieldValue.serverTimestamp(),
            "displayName": user.displayName ?? (user.email ?? "User").components(separatedBy: "@").first ?? "User",
            "email": (user.email ?? "").lowercased(),
            "photoURL": user.photoURL?.absoluteString ?? "",
        ], forDocument: PFPath.members(tenant.documentID).document(uid))
        try await batch.commit()
        return tenant.documentID
    }
}
