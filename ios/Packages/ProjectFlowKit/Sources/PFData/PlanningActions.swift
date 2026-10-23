import Foundation
import Observation
import FirebaseFirestore
import FirebaseFunctions
import PFModel

// Writes and live data for planning: labels, milestones, sprints, initiatives, groups, personal-task move.
// Same contract as `WorkActions` (C1): full paths, `updatedBy`/`updatedAt` on task writes; activity entries for
// initiative/milestone changes are written client-side like the web (`logActivity`).

// MARK: - Live data

/// Labels of one project (`projects/{p}/categories`), sorted by name.
@Observable
public final class ProjectLabelsStore {
    public let tenantId: String
    public let projectId: String
    public private(set) var labels: [ProjectLabel] = []
    private let listeners = ListenerBag()

    public init(tenantId: String, projectId: String) {
        self.tenantId = tenantId
        self.projectId = projectId
    }

    public func start() {
        guard listeners.keys.isEmpty else { return }
        listeners.set("labels", PFPath.categories(tenantId, projectId).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.labels = snapshot.documents.compactMap { doc in doc.fields.map { ProjectLabel(id: doc.documentID, fields: $0) } }
                    .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            }
        })
    }

    public func stop() { listeners.removeAll() }

    public func color(of name: String) -> String? { labels.first { $0.name == name }?.color }
}

/// Workspace groups (`tenants/{t}/groups`).
@Observable
public final class WorkspaceGroupsStore {
    public let tenantId: String
    public private(set) var groups: [WorkspaceGroup] = []
    private let listeners = ListenerBag()

    public init(tenantId: String) { self.tenantId = tenantId }

    public func start() {
        guard listeners.keys.isEmpty else { return }
        listeners.set("groups", PFPath.groups(tenantId).addSnapshotListener { [weak self] snapshot, _ in
            MainActor.assumeIsolated {
                guard let self, let snapshot else { return }
                self.groups = snapshot.documents.compactMap { doc in doc.fields.map { WorkspaceGroup(id: doc.documentID, fields: $0) } }
                    .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            }
        })
    }

    public func stop() { listeners.removeAll() }
}

// MARK: - Drafts

public struct InitiativeDraft: Sendable {
    public var title = ""
    public var description = ""
    public var status = "Planning"
    public var priority: TaskPriority? = .medium
    public var health: InitiativeHealth?
    public var startDate: FlexDate?
    public var dueDate: FlexDate?
    public var assigneeIds: [String] = []
    public var successMetric = ""
    public var color: String?

    public init() {}

    public init(_ initiative: Initiative) {
        title = initiative.title
        description = initiative.summary ?? ""
        status = initiative.statusRaw
        priority = initiative.priority
        health = initiative.health
        startDate = initiative.startDate
        dueDate = initiative.dueDate
        assigneeIds = initiative.assigneeIds
        successMetric = initiative.successMetric ?? ""
        color = initiative.color
    }
}

public struct MilestoneDraft: Sendable {
    public var title = ""
    public var description = ""
    public var dueDate: FlexDate?
    public var status = "Pending"
    public var linkedTaskIds: [String] = []
    public var linkedInitiativeId: String?

    public init() {}

    public init(_ milestone: Milestone) {
        title = milestone.title
        description = milestone.summary ?? ""
        dueDate = milestone.dueDate
        status = milestone.statusRaw
        linkedTaskIds = milestone.linkedTaskIds
        linkedInitiativeId = milestone.linkedInitiativeId
    }
}

public struct SprintDraft: Sendable {
    public var name = ""
    public var goal = ""
    public var startDate: FlexDate?
    public var endDate: FlexDate?

    public init() {}

    public init(_ sprint: Sprint) {
        name = sprint.name
        goal = sprint.goal ?? ""
        startDate = sprint.startDate
        endDate = sprint.endDate
    }
}

// MARK: - Actions

@MainActor
public struct PlanningActions {
    public let tenantId: String
    public let uid: String
    public let actorName: String
    public let actorPhotoURL: String?

    public init(tenantId: String, uid: String, actorName: String, actorPhotoURL: String? = nil) {
        self.tenantId = tenantId
        self.uid = uid
        self.actorName = actorName
        self.actorPhotoURL = actorPhotoURL
    }

    private var stamp: [String: Any] { ["updatedBy": uid, "updatedAt": FieldValue.serverTimestamp()] }

    private func logActivity(_ projectId: String, action: String, target: String, type: String, relatedId: String?) async {
        _ = try? await PFPath.activities(tenantId, projectId).addDocument(data: [
            "projectId": projectId, "tenantId": tenantId, "ownerId": uid,
            "user": actorName.isEmpty ? "User" : actorName, "userAvatar": actorPhotoURL ?? "",
            "action": action, "target": target, "details": "", "relatedId": relatedId ?? NSNull(),
            "type": type, "createdAt": FieldValue.serverTimestamp(),
        ])
    }

    // MARK: Task fields

    /// Labels are stored by name in the task's `category` array (cleared when empty, like the web).
    public func setLabels(_ ref: TaskRef, _ names: [String]) async throws {
        var data = stamp
        data["category"] = names.isEmpty ? FieldValue.delete() : names
        try await PFPath.task(ref).updateData(data)
    }

    /// Creates a label unless one with the same (case-insensitive) name exists; returns its name.
    @discardableResult
    public func createLabel(projectId: String, name: String, color: String) async throws -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw PFDataError.message("Empty label") }
        let collection = PFPath.categories(tenantId, projectId)
        let existing = try await collection.whereField("normalized", isEqualTo: trimmed.lowercased()).getDocuments()
        if let doc = existing.documents.first { return (doc.data()["name"] as? String) ?? trimmed }
        try await collection.addDocument(data: [
            "projectId": projectId, "tenantId": tenantId, "ownerId": uid,
            "name": trimmed, "normalized": trimmed.lowercased(), "color": color,
            "createdAt": FieldValue.serverTimestamp(),
        ])
        return trimmed
    }

    public func setSprint(_ ref: TaskRef, _ sprintId: String?) async throws {
        var data = stamp
        data["sprintId"] = sprintId ?? FieldValue.delete()
        try await PFPath.task(ref).updateData(data)
    }

    public func setInitiative(_ ref: TaskRef, _ initiativeId: String?) async throws {
        var data = stamp
        data["initiativeId"] = initiativeId ?? FieldValue.delete()
        data["legacyInitiativeRoot"] = false
        try await PFPath.task(ref).updateData(data)
    }

    public func setAssignedGroups(_ ref: TaskRef, _ groupIds: [String]) async throws {
        var data = stamp
        data["assignedGroupIds"] = groupIds
        try await PFPath.task(ref).updateData(data)
    }

    public func deleteComment(projectId: String, commentId: String) async throws {
        try await PFPath.comments(tenantId, projectId).document(commentId).delete()
    }

    /// Links `taskId` to exactly one milestone (or none): removed from all others, added to `milestoneId`.
    public func setTaskMilestone(projectId: String, taskId: String, milestoneId: String?, all milestones: [Milestone]) async throws {
        let batch = PFFirebase.db.batch()
        for milestone in milestones where milestone.linkedTaskIds.contains(taskId) && milestone.id != milestoneId {
            batch.updateData(["linkedTaskIds": FieldValue.arrayRemove([taskId])], forDocument: PFPath.milestones(tenantId, projectId).document(milestone.id))
        }
        if let milestoneId, !(milestones.first { $0.id == milestoneId }?.linkedTaskIds.contains(taskId) ?? false) {
            batch.updateData(["linkedTaskIds": FieldValue.arrayUnion([taskId])], forDocument: PFPath.milestones(tenantId, projectId).document(milestoneId))
        }
        try await batch.commit()
    }

    // MARK: Initiatives

    private func initiativeData(_ draft: InitiativeDraft, creating: Bool) -> [String: Any] {
        var data: [String: Any] = [
            "title": draft.title.trimmingCharacters(in: .whitespacesAndNewlines),
            "description": draft.description,
            "status": draft.status,
            "assigneeIds": draft.assigneeIds,
            "successMetric": draft.successMetric.trimmingCharacters(in: .whitespacesAndNewlines),
        ]
        // Optional fields are removed when cleared on update; on create they are simply left out
        // (dates are written as '' like the web).
        func optional(_ key: String, _ value: Any?, emptyString: Bool = false) {
            if let value { data[key] = value } else if !creating { data[key] = FieldValue.delete() } else if emptyString { data[key] = "" }
        }
        optional("priority", draft.priority?.rawValue)
        optional("health", draft.health?.rawValue)
        optional("startDate", draft.startDate?.webString, emptyString: true)
        optional("dueDate", draft.dueDate?.webString, emptyString: true)
        optional("color", draft.color)
        return data
    }

    @discardableResult
    public func createInitiative(projectId: String, _ draft: InitiativeDraft) async throws -> String {
        let doc = PFPath.initiatives(tenantId, projectId).document()
        var data = initiativeData(draft, creating: true)
        data.merge([
            "projectId": projectId, "tenantId": tenantId, "ownerId": uid, "createdBy": uid,
            "assignedGroupIds": [String](), "outcome": "", "createdAt": FieldValue.serverTimestamp(),
        ]) { _, new in new }
        data.merge(stamp) { _, new in new }
        try await doc.setData(data)
        await logActivity(projectId, action: "Created initiative \"\(draft.title)\"", target: "Initiatives", type: "initiative", relatedId: doc.documentID)
        return doc.documentID
    }

    public func updateInitiative(projectId: String, id: String, _ draft: InitiativeDraft) async throws {
        var data = initiativeData(draft, creating: false)
        data.merge(stamp) { _, new in new }
        if draft.status == "Done" { data["completedAt"] = FieldValue.serverTimestamp() } else { data["completedAt"] = FieldValue.delete() }
        try await PFPath.initiatives(tenantId, projectId).document(id).updateData(data)
        await logActivity(projectId, action: "Updated initiative \"\(draft.title)\"", target: "Initiatives", type: "initiative", relatedId: id)
    }

    /// Detaches every task of the initiative, then deletes it (web `deleteInitiative`).
    public func deleteInitiative(projectId: String, id: String, title: String) async throws {
        let tasks = try await PFPath.tasks(tenantId, projectId).whereField("initiativeId", isEqualTo: id).getDocuments()
        let batch = PFFirebase.db.batch()
        for doc in tasks.documents {
            var data = stamp
            data["initiativeId"] = FieldValue.delete()
            data["legacyInitiativeRoot"] = false
            batch.updateData(data, forDocument: doc.reference)
        }
        batch.deleteDocument(PFPath.initiatives(tenantId, projectId).document(id))
        try await batch.commit()
        await logActivity(projectId, action: "Deleted initiative \"\(title)\"", target: "Initiatives", type: "initiative", relatedId: id)
    }

    // MARK: Milestones

    private func milestoneData(_ draft: MilestoneDraft) -> [String: Any] {
        var data: [String: Any] = [
            "title": draft.title.trimmingCharacters(in: .whitespacesAndNewlines),
            "description": draft.description,
            "status": draft.status,
            "linkedTaskIds": draft.linkedTaskIds,
        ]
        data["dueDate"] = draft.dueDate?.webString ?? ""
        data["linkedInitiativeId"] = draft.linkedInitiativeId ?? ""
        return data
    }

    /// Linked tasks without a due date inherit the milestone's (web `MilestoneModal`).
    private func inheritDueDate(_ draft: MilestoneDraft, projectId: String, tasksWithoutDue: [String]) async {
        guard let due = draft.dueDate else { return }
        for id in tasksWithoutDue where draft.linkedTaskIds.contains(id) {
            var data = stamp
            data["dueDate"] = due.webString
            _ = try? await PFPath.tasks(tenantId, projectId).document(id).updateData(data)
        }
    }

    @discardableResult
    public func createMilestone(projectId: String, _ draft: MilestoneDraft, tasksWithoutDue: [String] = []) async throws -> String {
        let doc = PFPath.milestones(tenantId, projectId).document()
        var data = milestoneData(draft)
        data.merge(["projectId": projectId, "tenantId": tenantId, "createdBy": uid, "createdAt": FieldValue.serverTimestamp()]) { _, new in new }
        try await doc.setData(data)
        await logActivity(projectId, action: "Created milestone \"\(draft.title)\"", target: "Milestone", type: "status", relatedId: nil)
        await inheritDueDate(draft, projectId: projectId, tasksWithoutDue: tasksWithoutDue)
        return doc.documentID
    }

    public func updateMilestone(projectId: String, id: String, _ draft: MilestoneDraft, tasksWithoutDue: [String] = []) async throws {
        try await PFPath.milestones(tenantId, projectId).document(id).updateData(milestoneData(draft))
        await inheritDueDate(draft, projectId: projectId, tasksWithoutDue: tasksWithoutDue)
    }

    public func setMilestoneStatus(projectId: String, id: String, _ status: String) async throws {
        try await PFPath.milestones(tenantId, projectId).document(id).updateData(["status": status])
    }

    public func deleteMilestone(projectId: String, id: String) async throws {
        try await PFPath.milestones(tenantId, projectId).document(id).delete()
    }

    // MARK: Sprints

    private func sprintData(_ draft: SprintDraft) -> [String: Any] {
        var data: [String: Any] = ["name": draft.name.trimmingCharacters(in: .whitespacesAndNewlines), "goal": draft.goal]
        data["startDate"] = draft.startDate?.webString ?? ""
        data["endDate"] = draft.endDate?.webString ?? ""
        return data
    }

    @discardableResult
    public func createSprint(projectId: String, _ draft: SprintDraft) async throws -> String {
        let doc = PFPath.sprints(tenantId, projectId).document()
        var data = sprintData(draft)
        data.merge([
            "projectId": projectId, "status": "Planning", "createdBy": uid,
            "createdAt": FieldValue.serverTimestamp(), "updatedAt": FieldValue.serverTimestamp(),
        ]) { _, new in new }
        try await doc.setData(data)
        return doc.documentID
    }

    public func updateSprint(projectId: String, id: String, _ draft: SprintDraft) async throws {
        var data = sprintData(draft)
        data["updatedAt"] = FieldValue.serverTimestamp()
        try await PFPath.sprints(tenantId, projectId).document(id).updateData(data)
    }

    /// Only one sprint can be active (web `startSprint`). Starting early moves the start to today; the end
    /// falls back to start + 14 days when it is missing or before the start.
    public func startSprint(projectId: String, sprint: Sprint, today: FlexDate, activeSprints: [Sprint]) async throws {
        if activeSprints.contains(where: { $0.id != sprint.id && $0.statusRaw == "Active" }) {
            throw PFDataError.message("There is already an active sprint.")
        }
        let start = (sprint.startDate.map { $0.instant > today.instant } ?? true) ? today : (sprint.startDate ?? today)
        var end = sprint.endDate ?? start
        if sprint.endDate == nil || end.instant < start.instant {
            end = FlexDate(instant: start.instant.addingTimeInterval(14 * 86_400), isDateOnly: start.isDateOnly)
        }
        try await PFPath.sprints(tenantId, projectId).document(sprint.id).updateData([
            "status": "Active", "startDate": start.webString, "endDate": end.webString,
            "updatedAt": FieldValue.serverTimestamp(),
        ])
    }

    /// Completes a sprint; unfinished tasks move to `destination` (next sprint) or the backlog (nil).
    public func completeSprint(projectId: String, id: String, unfinishedTaskIds: [String], destination: String?) async throws {
        let batch = PFFirebase.db.batch()
        for taskId in unfinishedTaskIds {
            var data = stamp
            data["sprintId"] = destination ?? FieldValue.delete()
            batch.updateData(data, forDocument: PFPath.tasks(tenantId, projectId).document(taskId))
        }
        batch.updateData(["status": "Completed", "updatedAt": FieldValue.serverTimestamp()], forDocument: PFPath.sprints(tenantId, projectId).document(id))
        try await batch.commit()
    }

    /// Deleting a sprint sends its tasks back to the backlog.
    public func deleteSprint(projectId: String, id: String, taskIds: [String]) async throws {
        let batch = PFFirebase.db.batch()
        for taskId in taskIds {
            var data = stamp
            data["sprintId"] = FieldValue.delete()
            batch.updateData(data, forDocument: PFPath.tasks(tenantId, projectId).document(taskId))
        }
        batch.deleteDocument(PFPath.sprints(tenantId, projectId).document(id))
        try await batch.commit()
    }

    // MARK: Personal tasks

    /// Moves a personal task into a project: a project task with the same title, dates, priority,
    /// description, labels and state replaces it (web `movePersonalTaskToProject`). Returns the new ref.
    @discardableResult
    public func movePersonalTask(_ personalId: String, toProject projectId: String) async throws -> TaskRef {
        let source = PFPath.personalTasks(tenantId, uid).document(personalId)
        let snapshot = try await source.getDocument()
        guard let old = snapshot.data() else { throw PFDataError.message("Personal task not found") }
        let completed = (old["isCompleted"] as? Bool) ?? false
        let target = PFPath.tasks(tenantId, projectId).document()
        var data: [String: Any] = [
            "title": (old["title"] as? String) ?? "",
            "projectId": projectId, "tenantId": tenantId, "ownerId": uid, "createdBy": uid,
            "isCompleted": completed,
            "status": completed ? TaskStatus.done.rawValue : ((old["status"] as? String) ?? TaskStatus.open.rawValue),
            "priority": (old["priority"] as? String) ?? TaskPriority.medium.rawValue,
            "assigneeIds": [uid], "assigneeId": uid,
            "createdAt": FieldValue.serverTimestamp(),
        ]
        data.merge(stamp) { _, new in new }
        for key in ["dueDate", "scheduledDate", "description", "category", "nextStep"] {
            if let value = old[key], !(value is NSNull), !((value as? String)?.isEmpty ?? false) { data[key] = value }
        }
        if completed {
            data["completedAt"] = FieldValue.serverTimestamp()
            data["completedBy"] = uid
        }
        let batch = PFFirebase.db.batch()
        batch.setData(data, forDocument: target)
        batch.deleteDocument(source)
        try await batch.commit()
        return TaskRef(tenantId: tenantId, projectId: projectId, taskId: target.documentID)
    }

    // MARK: Inbox

    /// Deletes all notifications in chunks of 400 (batch limit is 500).
    public func deleteAllNotifications(_ items: [InboxItem]) async throws {
        for chunk in stride(from: 0, to: items.count, by: 400).map({ Array(items[$0..<min($0 + 400, items.count)]) }) {
            let batch = PFFirebase.db.batch()
            for item in chunk { batch.deleteDocument(PFPath.notifications(item.tenantId).document(item.id)) }
            try await batch.commit()
        }
    }

    // MARK: Scheduling

    /// Applies "Smart verteilen": sets `scheduledDate` per task (own project tasks, co-assignee tasks and
    /// personal tasks alike) and assigns formerly unassigned tasks to me.
    public func applySchedule(_ changes: [(ref: TaskRef?, personalId: String?, day: FlexDate, assignToMe: Bool)]) async throws {
        for chunk in stride(from: 0, to: changes.count, by: 200).map({ Array(changes[$0..<min($0 + 200, changes.count)]) }) {
            let batch = PFFirebase.db.batch()
            for change in chunk {
                if let ref = change.ref {
                    var data = stamp
                    data["scheduledDate"] = change.day.webString
                    if change.assignToMe {
                        data["assigneeIds"] = [uid]
                        data["assigneeId"] = uid
                    }
                    batch.updateData(data, forDocument: PFPath.task(ref))
                } else if let personalId = change.personalId {
                    batch.updateData(["scheduledDate": change.day.webString], forDocument: PFPath.personalTasks(tenantId, uid).document(personalId))
                }
            }
            try await batch.commit()
        }
    }

    // MARK: Team tasks

    /// Open tasks of co-assignees (for the scheduler's capacity model). Best effort: needs the
    /// `tenantId` + `assigneeIds` collection-group index; returns what it can read.
    public func teamTasks(of userIds: [String]) async -> [WorkTask] {
        var result: [String: WorkTask] = [:]
        for chunk in stride(from: 0, to: userIds.count, by: 10).map({ Array(userIds[$0..<min($0 + 10, userIds.count)]) }) {
            let query = PFFirebase.db.collectionGroup("tasks")
                .whereField("tenantId", isEqualTo: tenantId)
                .whereField("assigneeIds", arrayContainsAny: chunk)
            guard let snapshot = try? await query.getDocuments() else { continue }
            for doc in snapshot.documents {
                guard let fields = doc.fields else { continue }
                let projectId = doc.reference.parent.parent?.documentID ?? ""
                let task = WorkTask(id: doc.documentID, projectId: projectId, tenantId: tenantId, fields: fields)
                if !task.isCompleted { result[task.id] = task }
            }
        }
        return Array(result.values)
    }
}

// MARK: - AI

/// Description drafts through the `callGemini` callable (same function the web uses). The server
/// meters the monthly AI quota and answers `resource-exhausted` when it is used up.
@MainActor
public enum PlanningAI {
    public enum Failure: Error, Equatable { case quotaExceeded, unavailable, empty }

    public static func draftDescription(taskTitle: String, projectTitle: String?, currentText: String?, language: String) async throws -> String {
        let languageName = language == "de" ? "German" : "English"
        var prompt = "Write a clear, concise task description (2-4 sentences, plain text, no headings or markdown) for a task named \"\(taskTitle)\""
        if let projectTitle, !projectTitle.isEmpty { prompt += " in the project \"\(projectTitle)\"" }
        prompt += "."
        if let currentText, !currentText.isEmpty { prompt += " Existing notes to build on: \(currentText.prefix(600))." }
        prompt += " Respond in \(languageName)."
        do {
            let data = try await PFCallables.call("callGemini", ["prompt": prompt, "temperature": 0.7, "jsonMode": false, "model": "gpt-5-mini"])
            let text = ((data as? [String: Any])?["text"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !text.isEmpty else { throw Failure.empty }
            return text
        } catch let failure as Failure {
            throw failure
        } catch {
            let ns = error as NSError
            if ns.domain == FunctionsErrorDomain, ns.code == FunctionsErrorCode.resourceExhausted.rawValue { throw Failure.quotaExceeded }
            throw Failure.unavailable
        }
    }
}
