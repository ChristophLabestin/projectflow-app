import Foundation
import Observation
import FirebaseAuth
import FirebaseFirestore
import PFModel

// Team, workspace settings and project team: models, live store and writes. Field names and rules mirror
// `web/services/domain/{workspaceMembersService,workspaceGroupsService,workspacesService}.ts`, `rolesService`/
// `dataService` (tenant roles, project members) and `firestore.rules` (Owner/Admin manage the team).

// MARK: Models

public struct TeamGroup: Identifiable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var color: String
    public var summary: String
    public var memberIds: [String]

    init(id: String, fields f: Fields) {
        self.id = id
        name = f.string("name") ?? "—"
        color = f.string("color") ?? "#3b82f6"
        summary = f.string("description") ?? ""
        memberIds = f.strings("memberIds")
    }
}

public struct TeamInvitation: Identifiable, Hashable, Sendable {
    public enum Kind: String, Sendable { case email, link }
    public let id: String
    public var kind: Kind
    public var email: String?
    public var role: String
    public var projectIds: [String]
    public var invitedByName: String
    public var expiresAt: Date?
    public var maxUses: Int?
    public var uses: Int

    init(id: String, fields f: Fields) {
        self.id = id
        kind = Kind(rawValue: f.string("kind") ?? "link") ?? .link
        email = f.string("email")
        role = f.string("role") ?? "Member"
        projectIds = f.strings("projectIds")
        invitedByName = f.string("invitedByName") ?? ""
        expiresAt = f.string("expiresAt").flatMap { ISO8601DateFormatter.pf.date(from: $0) }
        maxUses = f.int("maxUses")
        uses = f.int("uses") ?? 0
    }

    public var isExpired: Bool { expiresAt.map { $0 < Date() } ?? false }
}

/// Workspace role document `tenants/{t}/roles/{id}` (web `FirestoreRole`): allow/deny permission nodes.
public struct TenantRole: Identifiable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var color: String
    public var summary: String
    public var position: Int
    public var isSystem: Bool
    public var allow: [String]
    public var deny: [String]

    init(id: String, fields f: Fields) {
        self.id = id
        name = f.string("name") ?? "—"
        color = f.string("color") ?? "#3b82f6"
        summary = f.string("description") ?? ""
        position = f.int("position") ?? 0
        isSystem = f.bool("isSystem") ?? false
        let permissions = f.map("permissions")
        allow = permissions?.strings("allow") ?? []
        deny = permissions?.strings("deny") ?? []
    }
}

public struct WorkspaceProfile: Hashable, Sendable {
    public var name = ""
    public var summary = ""
    public var website = ""
    public var contactEmail = ""
    public var ownerId: String?

    public init(name: String = "", summary: String = "", website: String = "", contactEmail: String = "", ownerId: String? = nil) {
        self.name = name; self.summary = summary; self.website = website; self.contactEmail = contactEmail; self.ownerId = ownerId
    }
}

extension ISO8601DateFormatter {
    static let pf: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

// MARK: Live data

/// Groups, custom roles, pending invitations (Owner/Admin only, like the rules) and the workspace profile.
@Observable
public final class TeamStore {
    public let tenantId: String
    public let canAdmin: Bool
    public private(set) var groups: [TeamGroup] = []
    public private(set) var roles: [TenantRole] = []
    public private(set) var invitations: [TeamInvitation] = []
    public private(set) var profile = WorkspaceProfile()
    /// Membership docs by uid (role ids and group ids; `WorkspaceStore.people` only has the display data).
    public private(set) var memberships: [String: Membership] = [:]
    public private(set) var loaded: Set<String> = []
    private let listeners = ListenerBag()

    public init(tenantId: String, canAdmin: Bool) {
        self.tenantId = tenantId
        self.canAdmin = canAdmin
    }

    public func start() {
        guard listeners.keys.isEmpty else { return }
        let t = tenantId
        listeners.set("tenant", PFPath.tenant(t).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let f = snapshot?.fields else { return }
                self.profile = WorkspaceProfile(name: f.string("name") ?? "", summary: f.string("description") ?? "",
                                                website: f.string("website") ?? "", contactEmail: f.string("contactEmail") ?? "",
                                                ownerId: f.string("ownerId"))
                self.loaded.insert("tenant")
            }
        })
        listeners.set("members", PFPath.members(t).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                var map: [String: Membership] = [:]
                for doc in snapshot.documents {
                    guard let fields = doc.fields else { continue }
                    let id = fields.string("uid") ?? doc.documentID
                    map[id] = Membership(tenantId: t, uid: id, fields: fields)
                }
                self.memberships = map
                self.loaded.insert("members")
            }
        })
        listeners.set("groups", PFPath.tenant(t).collection("groups").addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.groups = snapshot.documents.compactMap { doc in doc.fields.map { TeamGroup(id: doc.documentID, fields: $0) } }
                    .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
                self.loaded.insert("groups")
            }
        })
        listeners.set("roles", PFPath.tenant(t).collection("roles").addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.roles = snapshot.documents.compactMap { doc in doc.fields.map { TenantRole(id: doc.documentID, fields: $0) } }
                    .sorted { $0.position > $1.position }
                self.loaded.insert("roles")
            }
        })
        guard canAdmin else { return }
        listeners.set("invitations", PFPath.tenant(t).collection("invitations").whereField("status", isEqualTo: "pending")
            .addSnapshotListener { [weak self] snapshot, _ in
                MainActor.assumeIsolated {
                    guard let self, let snapshot else { return }
                    self.invitations = snapshot.documents.compactMap { doc in doc.fields.map { TeamInvitation(id: doc.documentID, fields: $0) } }
                        .sorted { ($0.expiresAt ?? .distantFuture) < ($1.expiresAt ?? .distantFuture) }
                    self.loaded.insert("invitations")
                }
            })
    }

    public func stop() {
        listeners.removeAll()
        loaded = []
    }

    public func group(_ id: String) -> TeamGroup? { groups.first { $0.id == id } }
    public func role(_ id: String) -> TenantRole? { roles.first { $0.id == id } }
}

// MARK: Writes

@MainActor
public struct TeamActions {
    public let tenantId: String
    public let uid: String

    public init(tenantId: String, uid: String) {
        self.tenantId = tenantId
        self.uid = uid
    }

    private var tenant: DocumentReference { PFPath.tenant(tenantId) }
    private func member(_ id: String) -> DocumentReference { PFPath.members(tenantId).document(id) }
    private func group(_ id: String) -> DocumentReference { tenant.collection("groups").document(id) }

    // MARK: Members

    /// Owner/Admin/Member/Guest (`role` field). The Owner role is never set here (transfer is a callable).
    public func setRole(_ userId: String, role: String) async throws {
        try await member(userId).updateData(["role": role])
    }

    /// Custom role ids only (Discord-style stacking); system roles are not stored in `roleIds`.
    public func setRoleIds(_ userId: String, roleIds: [String]) async throws {
        try await member(userId).updateData(["roleIds": roleIds])
    }

    /// Port of web `removeUserFromWorkspace`: leaves groups and projects first, then deletes the membership.
    public func removeMember(_ userId: String) async throws {
        let snapshot = try await member(userId).getDocument()
        let groupIds = (snapshot.data()?["groupIds"] as? [String]) ?? []
        for groupId in groupIds {
            try? await group(groupId).updateData(["memberIds": FieldValue.arrayRemove([userId])])
        }
        let projects = try await PFPath.projects(tenantId).whereField("memberIds", arrayContains: userId).getDocuments()
        for project in projects.documents {
            let members = (project.data()["members"] as? [Any]) ?? []
            let kept = members.filter { Self.memberId($0) != userId }
            try? await project.reference.updateData([
                "members": kept, "memberIds": FieldValue.arrayRemove([userId]), "roles.\(userId)": FieldValue.delete(),
            ])
        }
        try await member(userId).delete()
    }

    /// Web `leaveWorkspace`: delete the own membership (not allowed for the Owner by the rules).
    public func leaveWorkspace() async throws {
        try await member(uid).delete()
    }

    // MARK: Invitations

    /// Web `createInvitation`; e-mail delivery through `sendInvitation` is best effort (the link always works).
    @discardableResult
    public func createInvitation(kind: TeamInvitation.Kind, email: String?, role: String, tenantName: String, inviterName: String,
                                 projectIds: [String] = [], maxUses: Int? = nil, language: String) async throws -> String {
        let ref = tenant.collection("invitations").document()
        let expires = ISO8601DateFormatter.pf.string(from: Date().addingTimeInterval(14 * 86400))
        var data: [String: Any] = [
            "tenantId": tenantId, "tenantName": tenantName, "kind": kind.rawValue,
            "role": role, "projectIds": projectIds, "status": "pending",
            "invitedBy": uid, "invitedByName": inviterName,
            "createdAt": FieldValue.serverTimestamp(), "expiresAt": expires,
            "uses": 0,
        ]
        if kind == .email { data["maxUses"] = 1 } else { data["maxUses"] = maxUses ?? NSNull() }
        data["email"] = kind == .email ? (email ?? "").trimmingCharacters(in: .whitespaces).lowercased() : NSNull()
        try await ref.setData(data)
        if kind == .email {
            _ = try? await PFCallables.call("sendInvitation", ["tenantId": tenantId, "inviteId": ref.documentID, "language": language])
        }
        return ref.documentID
    }

    public func revokeInvitation(_ id: String) async throws {
        try await tenant.collection("invitations").document(id).updateData([
            "status": "revoked", "revokedAt": ISO8601DateFormatter.pf.string(from: Date()), "revokedBy": uid,
        ])
    }

    // MARK: Groups

    public func createGroup(name: String, color: String, summary: String) async throws {
        try await tenant.collection("groups").addDocument(data: [
            "tenantId": tenantId, "name": name, "color": color, "description": summary,
            "memberIds": [], "createdAt": FieldValue.serverTimestamp(),
        ])
    }

    public func updateGroup(_ id: String, name: String, color: String, summary: String) async throws {
        try await group(id).updateData(["name": name, "color": color, "description": summary])
    }

    public func deleteGroup(_ id: String, memberIds: [String]) async throws {
        for userId in memberIds { try? await member(userId).updateData(["groupIds": FieldValue.arrayRemove([id])]) }
        try await group(id).delete()
    }

    public func setGroupMember(_ userId: String, groupId: String, isMember: Bool) async throws {
        let op: (Any) -> FieldValue = isMember ? { FieldValue.arrayUnion([$0]) } : { FieldValue.arrayRemove([$0]) }
        try await group(groupId).updateData(["memberIds": op(userId)])
        try? await member(userId).updateData(["groupIds": op(groupId)])
    }

    // MARK: Custom roles (`tenants/{t}/roles`)

    public func saveRole(id: String?, name: String, color: String, summary: String, allow: [String], deny: [String], position: Int) async throws {
        let permissions: [String: Any] = ["allow": allow, "deny": deny]
        if let id {
            try await tenant.collection("roles").document(id).updateData([
                "name": name, "color": color, "description": summary, "permissions": permissions,
                "updatedAt": FieldValue.serverTimestamp(),
            ])
        } else {
            try await tenant.collection("roles").addDocument(data: [
                "name": name, "color": color, "description": summary, "position": position, "isSystem": false,
                "permissions": permissions, "createdBy": uid,
                "createdAt": FieldValue.serverTimestamp(), "updatedAt": FieldValue.serverTimestamp(),
            ])
        }
    }

    public func deleteRole(_ id: String, assignedTo userIds: [String]) async throws {
        for userId in userIds { try? await member(userId).updateData(["roleIds": FieldValue.arrayRemove([id])]) }
        try await tenant.collection("roles").document(id).delete()
    }

    // MARK: Workspace settings

    public func updateWorkspace(_ profile: WorkspaceProfile) async throws {
        try await tenant.updateData([
            "name": profile.name.trimmingCharacters(in: .whitespaces), "description": profile.summary,
            "website": profile.website, "contactEmail": profile.contactEmail,
            "updatedAt": FieldValue.serverTimestamp(),
        ])
    }

    public func renameWorkspace(_ name: String) async throws {
        try await tenant.updateData(["name": name.trimmingCharacters(in: .whitespaces), "updatedAt": FieldValue.serverTimestamp()])
    }

    public func transferOwnership(to newOwnerId: String) async throws {
        _ = try await PFCallables.call("transferWorkspaceOwnership", ["tenantId": tenantId, "newOwnerId": newOwnerId])
    }

    public func deleteWorkspace(confirmName: String) async throws {
        _ = try await PFCallables.call("deleteWorkspace", ["tenantId": tenantId, "confirmName": confirmName])
    }

    // MARK: Member workload

    /// Open tasks assigned to a person (same index as "my tasks").
    public func openTasks(of userId: String) async -> [WorkTask] {
        let snapshot = try? await PFFirebase.db.collectionGroup("tasks")
            .whereField("tenantId", isEqualTo: tenantId)
            .whereField("assigneeIds", arrayContains: userId).getDocuments()
        let tenantId = tenantId
        return (snapshot?.documents ?? []).compactMap { doc -> WorkTask? in
            guard let fields = doc.fields else { return nil }
            let projectId = doc.reference.parent.parent?.documentID ?? ""
            let task = WorkTask(id: doc.documentID, projectId: projectId, tenantId: tenantId, fields: fields)
            return task.isCompleted ? nil : task
        }
    }

    /// The `users/{uid}` document (bio, skills, privacy) as readable fields; nil when not readable.
    public static func userDetails(_ userId: String) async -> Fields? {
        (try? await PFPath.user(userId).getDocument())?.fields
    }

    static func memberId(_ entry: Any) -> String? {
        if let id = entry as? String { return id }
        guard let map = entry as? [String: Any] else { return nil }
        return (map["userId"] as? String) ?? (map["uid"] as? String) ?? (map["id"] as? String)
    }
}

/// Project members and their project roles (`members[]`, `memberIds`, `roles.{uid}`), like web
/// `addProjectMember` / `updateMemberRole` / `removeMember` and the invite acceptance.
@MainActor
public struct ProjectTeamActions {
    public let tenantId: String
    public let projectId: String
    public let uid: String

    public init(tenantId: String, projectId: String, uid: String) {
        self.tenantId = tenantId
        self.projectId = projectId
        self.uid = uid
    }

    private var ref: DocumentReference { PFPath.project(tenantId, projectId) }

    public func add(_ person: Person, role: String) async throws {
        let entry: [String: Any] = [
            "userId": person.id, "role": role, "joinedAt": Timestamp(date: Date()), "invitedBy": uid,
            "displayName": person.displayName, "email": person.email ?? "", "photoURL": person.photoURL ?? "",
        ]
        try await ref.updateData([
            "members": FieldValue.arrayUnion([entry]), "memberIds": FieldValue.arrayUnion([person.id]),
            "roles.\(person.id)": role, "updatedAt": FieldValue.serverTimestamp(),
        ])
    }

    public func setRole(_ userId: String, role: String) async throws {
        let snapshot = try await ref.getDocument()
        var members = (snapshot.data()?["members"] as? [Any]) ?? []
        var found = false
        members = members.map { entry in
            guard var map = entry as? [String: Any], TeamActions.memberId(map) == userId else { return entry }
            map["role"] = role
            found = true
            return map
        }
        if !found { members.append(["userId": userId, "role": role, "joinedAt": Timestamp(date: Date()), "invitedBy": uid]) }
        try await ref.updateData(["members": members, "roles.\(userId)": role, "updatedAt": FieldValue.serverTimestamp()])
    }

    public func remove(_ userId: String) async throws {
        let snapshot = try await ref.getDocument()
        let members = ((snapshot.data()?["members"] as? [Any]) ?? []).filter { TeamActions.memberId($0) != userId }
        try await ref.updateData([
            "members": members, "memberIds": FieldValue.arrayRemove([userId]),
            "roles.\(userId)": FieldValue.delete(), "updatedAt": FieldValue.serverTimestamp(),
        ])
    }
}
