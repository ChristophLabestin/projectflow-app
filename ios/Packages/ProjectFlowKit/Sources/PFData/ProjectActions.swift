import Foundation
import Observation
import FirebaseFirestore
import PFModel

// MARK: - Settings data (fields the project settings edit, read straight from the project document)

public struct ProjectRisk: Identifiable, Hashable, Sendable {
    public var id: String
    public var title: String
    public var mitigation: String
    public var severity: String
    public var status: String
    public var createdAt: String

    public init(id: String = "risk-\(Int(Date().timeIntervalSince1970 * 1000))", title: String, mitigation: String = "",
                severity: String = "medium", status: String = "open", createdAt: String = ISO8601DateFormatter().string(from: .now)) {
        self.id = id; self.title = title; self.mitigation = mitigation
        self.severity = severity; self.status = status; self.createdAt = createdAt
    }

    init(fields f: Fields) {
        self.init(id: f.string("id") ?? "risk-\(UUID().uuidString.prefix(6))", title: f.string("title") ?? "", mitigation: f.string("mitigation") ?? "",
                  severity: f.string("severity") ?? "medium", status: f.string("status") ?? "open",
                  createdAt: f.string("createdAt") ?? ISO8601DateFormatter().string(from: .now))
    }

    public var map: [String: Any] {
        var data: [String: Any] = ["id": id, "title": title, "severity": severity, "status": status, "createdAt": createdAt]
        if !mitigation.isEmpty { data["mitigation"] = mitigation }
        return data
    }
}

public struct ProjectLinkItem: Identifiable, Hashable, Sendable {
    public let id = UUID()
    public var title: String
    public var url: String
    /// Extra fields of an external resource (type, sensitivity, …) are kept as they are on save.
    var extra: [String: String] = [:]

    public init(title: String, url: String) { self.title = title; self.url = url }

    init(fields f: Fields) {
        title = f.string("title") ?? ""
        url = f.string("url") ?? ""
        for (key, value) in f.raw where key != "title" && key != "url" {
            if let text = value as? String { extra[key] = text }
        }
    }

    public var map: [String: Any] {
        var data: [String: Any] = extra
        data["title"] = title
        data["url"] = url
        return data
    }
}

/// Typed view of the project document fields that only the settings need.
public struct ProjectSettingsData: Sendable {
    public var title = ""
    public var description = ""
    public var status = ProjectStatus.active
    public var priority: TaskPriority?
    public var projectCategory = "general"
    public var templateId: String?
    public var projectType = "standard"
    public var projectState = "not specified"
    public var operatingMode = "build"
    public var cadence = "weekly"
    public var dateConfidence = "target"
    public var objective = ""
    public var successCriteria: [String] = []
    public var scope = ""
    public var decisionOwner = ""
    public var risks: [ProjectRisk] = []
    public var coverImage: String?
    public var squareIcon: String?
    public var modules: [String] = []
    public var links: [ProjectLinkItem] = []
    public var externalResources: [ProjectLinkItem] = []
    public var githubRepo = ""
    public var githubIssueSync = false
    public var isPrivate = false
    public var startDate: FlexDate?
    public var dueDate: FlexDate?
    public var ownerId: String?
    public var pausedFromStatus: String?
    public var memberCount = 0

    public init() {}

    public init(fields f: Fields) {
        title = f.string("title") ?? ""
        description = f.string("description") ?? ""
        status = ProjectStatus(raw: f.string("status"))
        priority = TaskPriority(raw: f.string("priority"))
        projectCategory = f.string("projectCategory") ?? "general"
        templateId = f.string("templateId")
        projectType = f.string("projectType") ?? "standard"
        projectState = f.string("projectState") ?? "not specified"
        let brief = f.map("brief")
        let model = f.map("operatingModel")
        operatingMode = f.string("operatingMode") ?? model?.string("mode") ?? "build"
        cadence = brief?.string("cadence") ?? model?.string("cadence") ?? "weekly"
        dateConfidence = f.string("dateConfidence") ?? model?.string("dateConfidence") ?? "target"
        objective = brief?.string("objective") ?? ""
        successCriteria = brief?.strings("successCriteria") ?? []
        scope = brief?.string("scope") ?? ""
        decisionOwner = brief?.string("decisionOwner") ?? ""
        risks = f.maps("riskRegister").map(ProjectRisk.init(fields:))
        coverImage = f.string("coverImage")
        squareIcon = f.string("squareIcon")
        modules = f.strings("modules")
        links = f.maps("links").map(ProjectLinkItem.init(fields:))
        externalResources = f.maps("externalResources").map(ProjectLinkItem.init(fields:))
        githubRepo = f.string("githubRepo") ?? ""
        githubIssueSync = f.bool("githubIssueSync") ?? false
        isPrivate = f.bool("isPrivate") ?? false
        startDate = f.date("startDate")
        dueDate = f.date("dueDate")
        ownerId = f.string("ownerId")
        pausedFromStatus = f.string("pausedFromStatus")
        memberCount = max(f.strings("memberIds").count, f.maps("members").count, f.strings("members").count)
    }
}

public struct ProjectSettingsLabel: Identifiable, Hashable, Sendable {
    public let id: String
    public var name: String
    public var color: String?
}

public struct ProjectNavPrefs: Hashable, Sendable {
    public var order: [String] = []
    public var hidden: [String] = []
    public init(order: [String] = [], hidden: [String] = []) { self.order = order; self.hidden = hidden }
}

// MARK: - Store

/// Live data for the project settings screen: the raw project document, its labels and the
/// signed-in user's navigation preferences.
@MainActor
@Observable
public final class ProjectSettingsStore {
    public let tenantId: String
    public let projectId: String
    public let uid: String
    public private(set) var data: ProjectSettingsData?
    public private(set) var labels: [ProjectSettingsLabel] = []
    public private(set) var navPrefs = ProjectNavPrefs()
    private let listeners = ListenerBag()

    public init(tenantId: String, projectId: String, uid: String) {
        self.tenantId = tenantId
        self.projectId = projectId
        self.uid = uid
    }

    public func start() {
        guard listeners.keys.isEmpty else { return }
        let t = tenantId, p = projectId, u = uid
        listeners.set("doc", PFPath.project(t, p).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let fields = snapshot?.fields else { return }
                self.data = ProjectSettingsData(fields: fields)
            }
        })
        listeners.set("labels", PFPath.project(t, p).collection("categories").addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.labels = snapshot.documents.compactMap { doc in
                    doc.fields.map { ProjectSettingsLabel(id: doc.documentID, name: $0.string("name") ?? "", color: $0.string("color")) }
                }
                .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            }
        })
        listeners.set("nav", PFPath.tenant(t).collection("users").document(u).collection("projectNavPrefs").document(p).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                if let fields = snapshot?.fields {
                    self.navPrefs = ProjectNavPrefs(order: fields.strings("order"), hidden: fields.strings("hidden"))
                } else {
                    self.navPrefs = ProjectNavPrefs()
                }
            }
        })
    }

    public func stop() { listeners.removeAll() }
}

// MARK: - Actions

/// Project writes (settings, lifecycle, labels, deletion). Field names and activity entries mirror web
/// `projectAdminService.updateProjectFields` and `useProjectLifecycle`.
@MainActor
public struct ProjectActions {
    public let tenantId: String
    public let uid: String
    public let actorName: String

    public init(tenantId: String, uid: String, actorName: String) {
        self.tenantId = tenantId
        self.uid = uid
        self.actorName = actorName
    }

    private func logActivity(_ projectId: String, _ action: String) async {
        _ = try? await PFPath.activities(tenantId, projectId).addDocument(data: [
            "projectId": projectId, "tenantId": tenantId, "ownerId": uid, "user": actorName, "userAvatar": "",
            "action": action, "target": "Project", "details": "", "relatedId": NSNull(), "type": "status",
            "createdAt": FieldValue.serverTimestamp(),
        ])
    }

    /// Writes `fields` to the project (null values delete the field) and records an activity entry.
    public func update(_ projectId: String, _ fields: [String: Any?], activity: String? = nil) async throws {
        var data: [String: Any] = [:]
        for (key, value) in fields { data[key] = value ?? FieldValue.delete() }
        guard !data.isEmpty else { return }
        try await PFPath.project(tenantId, projectId).updateData(data)
        if let activity { await logActivity(projectId, activity) }
    }

    // MARK: General

    public func setField(_ projectId: String, _ key: String, _ value: Any?) async throws {
        try await update(projectId, [key: value])
    }

    // MARK: Briefing

    // swiftlint:disable:next function_parameter_count
    public func saveBriefing(_ projectId: String, current: ProjectSettingsData, objective: String, successCriteria: [String], scope: String,
                             decisionOwner: String, cadence: String, operatingMode: String, dateConfidence: String, risks: [ProjectRisk]) async throws {
        var brief: [String: Any] = ["cadence": cadence]
        if !objective.trimmingCharacters(in: .whitespaces).isEmpty { brief["objective"] = objective.trimmingCharacters(in: .whitespacesAndNewlines) }
        let criteria = successCriteria.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }
        if !criteria.isEmpty { brief["successCriteria"] = criteria }
        if !scope.trimmingCharacters(in: .whitespaces).isEmpty { brief["scope"] = scope.trimmingCharacters(in: .whitespacesAndNewlines) }
        if !decisionOwner.trimmingCharacters(in: .whitespaces).isEmpty { brief["decisionOwner"] = decisionOwner.trimmingCharacters(in: .whitespacesAndNewlines) }
        try await update(projectId, [
            "brief": brief,
            "operatingMode": operatingMode,
            "dateConfidence": dateConfidence,
            "operatingModel": ["mode": operatingMode, "cadence": cadence, "dateConfidence": dateConfidence],
            "riskRegister": risks.filter { !$0.title.trimmingCharacters(in: .whitespaces).isEmpty }.map(\.map),
        ])
    }

    // MARK: Appearance

    public func setImage(_ projectId: String, cover: Bool, url: String?, fileId: String?) async throws {
        let key = cover ? "coverImage" : "squareIcon"
        try await update(projectId, [key: url, key + "FileId": fileId])
    }

    // MARK: Modules, links

    public func setModules(_ projectId: String, _ modules: [String]) async throws {
        try await update(projectId, ["modules": modules])
    }

    public func saveLinks(_ projectId: String, links: [ProjectLinkItem], resources: [ProjectLinkItem]) async throws {
        try await update(projectId, [
            "links": links.filter { !$0.title.isEmpty && !$0.url.isEmpty }.map(\.map),
            "externalResources": resources.filter { !$0.title.isEmpty && !$0.url.isEmpty }.map(\.map),
        ])
    }

    // MARK: Lifecycle (web useProjectLifecycle)

    public func pause(_ project: Project) async throws {
        guard project.status != .onHold, project.status != .canceled else { return }
        let now = ISO8601DateFormatter().string(from: .now)
        try await update(project.id, [
            "status": ProjectStatus.onHold.rawValue, "pausedAt": now, "pausedBy": uid,
            "pausedFromStatus": project.status.rawValue, "lastPauseStartedAt": now,
        ], activity: "Paused project \"\(project.title)\"")
    }

    public func resume(_ project: Project, pausedFrom: String?) async throws {
        guard project.status == .onHold else { return }
        var status = ProjectStatus.active
        if let pausedFrom, let previous = ProjectStatus(rawValue: pausedFrom), previous != .onHold, previous != .canceled { status = previous }
        try await update(project.id, [
            "status": status.rawValue, "pausedAt": "", "pausedBy": "",
            "lastResumedAt": ISO8601DateFormatter().string(from: .now),
        ], activity: "Resumed project \"\(project.title)\"")
    }

    public func cancel(_ project: Project) async throws {
        guard project.status != .canceled else { return }
        let now = ISO8601DateFormatter().string(from: .now)
        try await update(project.id, [
            "status": ProjectStatus.canceled.rawValue, "canceledAt": now, "canceledBy": uid,
            "canceledFromStatus": project.status.rawValue, "lastCanceledAt": now, "pausedAt": "", "pausedBy": "",
        ], activity: "Canceled project \"\(project.title)\"")
    }

    public func complete(_ project: Project) async throws {
        guard project.status != .completed else { return }
        try await update(project.id, ["status": ProjectStatus.completed.rawValue], activity: "Completed project \"\(project.title)\"")
    }

    /// Cascading delete runs server-side (`deleteProject` callable).
    public func delete(_ projectId: String) async throws {
        _ = try await PFCallables.call("deleteProject", ["tenantId": tenantId, "projectId": projectId])
    }

    // MARK: Labels (web `addProjectCategory` & co.)

    public func addLabel(_ projectId: String, name: String, color: String) async throws {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        let collection = PFPath.project(tenantId, projectId).collection("categories")
        let existing = try await collection.whereField("normalized", isEqualTo: clean.lowercased()).getDocuments()
        guard existing.isEmpty else { throw ProjectActionError.labelExists }
        _ = try await collection.addDocument(data: [
            "projectId": projectId, "tenantId": tenantId, "ownerId": uid, "name": clean, "normalized": clean.lowercased(),
            "color": color, "createdAt": FieldValue.serverTimestamp(),
        ])
    }

    public func updateLabel(_ projectId: String, id: String, name: String, color: String) async throws {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        try await PFPath.project(tenantId, projectId).collection("categories").document(id)
            .updateData(["name": clean, "normalized": clean.lowercased(), "color": color])
    }

    public func deleteLabel(_ projectId: String, id: String) async throws {
        try await PFPath.project(tenantId, projectId).collection("categories").document(id).delete()
    }

    // MARK: Navigation preferences (per user)

    public func saveNavPrefs(_ projectId: String, _ prefs: ProjectNavPrefs) async throws {
        try await PFPath.tenant(tenantId).collection("users").document(uid).collection("projectNavPrefs").document(projectId)
            .setData(["order": prefs.order, "hidden": prefs.hidden])
    }
}

public enum ProjectActionError: Error { case labelExists }
