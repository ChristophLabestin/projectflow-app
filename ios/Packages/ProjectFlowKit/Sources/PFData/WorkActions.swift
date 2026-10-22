import Foundation
import FirebaseFirestore
import PFModel

/// All writes the iOS app performs. Contract C1: every task/subtask/comment write carries
/// `updatedBy` + `updatedAt`; side effects (activity, progress, notifications, isCompleted⇄status)
/// are done by Firestore triggers, so the app only writes the fields themselves and always by full path.
@MainActor
public struct WorkActions {
    public let tenantId: String
    public let uid: String
    public let actorName: String

    public init(tenantId: String, uid: String, actorName: String) {
        self.tenantId = tenantId
        self.uid = uid
        self.actorName = actorName
    }

    private var stamp: [String: Any] { ["updatedBy": uid, "updatedAt": FieldValue.serverTimestamp()] }

    // MARK: Tasks

    public func setCompleted(_ ref: TaskRef, _ completed: Bool) async throws {
        var data = stamp
        data["isCompleted"] = completed
        data["status"] = completed ? TaskStatus.done.rawValue : TaskStatus.open.rawValue
        if completed {
            data["completedAt"] = FieldValue.serverTimestamp()
            data["completedBy"] = uid
        } else {
            data["completedAt"] = FieldValue.delete()
            data["completedBy"] = FieldValue.delete()
        }
        try await PFPath.task(ref).updateData(data)
    }

    public func setStatus(_ ref: TaskRef, _ status: TaskStatus) async throws {
        var data = stamp
        data["status"] = status.rawValue
        data["isCompleted"] = status == .done
        if status == .done {
            data["completedAt"] = FieldValue.serverTimestamp()
            data["completedBy"] = uid
        }
        try await PFPath.task(ref).updateData(data)
    }

    public func setPriority(_ ref: TaskRef, _ priority: TaskPriority?) async throws {
        var data = stamp
        data["priority"] = priority?.rawValue ?? FieldValue.delete()
        try await PFPath.task(ref).updateData(data)
    }

    public func setDueDate(_ ref: TaskRef, _ date: FlexDate?) async throws {
        try await setField(ref, "dueDate", date?.webString)
    }

    public func setScheduledDate(_ ref: TaskRef, _ date: FlexDate?) async throws {
        try await setField(ref, "scheduledDate", date?.webString)
    }

    public func setStartDate(_ ref: TaskRef, _ date: FlexDate?) async throws {
        try await setField(ref, "startDate", date?.webString)
    }

    public func setNextStep(_ ref: TaskRef, _ text: String?) async throws {
        try await setField(ref, "nextStep", text?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty)
    }

    public func setBlocked(_ ref: TaskRef, note: String?) async throws {
        var data = stamp
        data["status"] = TaskStatus.blocked.rawValue
        data["isCompleted"] = false
        data["blockerNote"] = note?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? FieldValue.delete()
        try await PFPath.task(ref).updateData(data)
    }

    public func clearBlocker(_ ref: TaskRef) async throws {
        var data = stamp
        data["status"] = TaskStatus.inProgress.rawValue
        data["blockerNote"] = FieldValue.delete()
        try await PFPath.task(ref).updateData(data)
    }

    public func setTitle(_ ref: TaskRef, _ title: String) async throws {
        try await setField(ref, "title", title.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    public func setDescription(_ ref: TaskRef, html: String) async throws {
        try await setField(ref, "description", html)
    }

    public func setAssignees(_ ref: TaskRef, _ ids: [String]) async throws {
        var data = stamp
        data["assigneeIds"] = ids
        data["assigneeId"] = ids.first ?? FieldValue.delete()
        try await PFPath.task(ref).updateData(data)
    }

    public func addDependency(_ ref: TaskRef, blockedBy otherTaskId: String) async throws {
        var data = stamp
        data["dependencies"] = FieldValue.arrayUnion([otherTaskId])
        data["status"] = TaskStatus.blocked.rawValue
        try await PFPath.task(ref).updateData(data)
    }

    public func removeDependency(_ ref: TaskRef, _ otherTaskId: String) async throws {
        var data = stamp
        data["dependencies"] = FieldValue.arrayRemove([otherTaskId])
        try await PFPath.task(ref).updateData(data)
    }

    public func setReminders(_ ref: TaskRef, _ reminders: [ProjectReminder]) async throws {
        var data = stamp
        data["reminders"] = reminders.map(\.firestoreValue)
        try await PFPath.task(ref).updateData(data)
    }

    public func delete(_ ref: TaskRef) async throws {
        try await PFPath.task(ref).delete()
    }

    /// Creates a project task with the same base fields as web `addTask`.
    @discardableResult
    public func createTask(projectId: String, title: String, dueDate: FlexDate? = nil, scheduledDate: FlexDate? = nil,
                           priority: TaskPriority? = nil, assigneeIds: [String]? = nil, status: TaskStatus = .open,
                           initiativeId: String? = nil, description: String? = nil) async throws -> TaskRef {
        let doc = PFPath.tasks(tenantId, projectId).document()
        let assignees = assigneeIds ?? [uid]
        var data: [String: Any] = [
            "title": title.trimmingCharacters(in: .whitespacesAndNewlines),
            "projectId": projectId, "tenantId": tenantId,
            "ownerId": uid, "createdBy": uid,
            "isCompleted": status == .done, "status": status.rawValue,
            "priority": (priority ?? .medium).rawValue,
            "assigneeIds": assignees,
            "createdAt": FieldValue.serverTimestamp(),
        ]
        data.merge(stamp) { _, new in new }
        if let first = assignees.first { data["assigneeId"] = first }
        if let dueDate { data["dueDate"] = dueDate.webString }
        if let scheduledDate { data["scheduledDate"] = scheduledDate.webString }
        if let initiativeId { data["initiativeId"] = initiativeId }
        if let description, !description.isEmpty { data["description"] = description }
        try await doc.setData(data)
        return TaskRef(tenantId: tenantId, projectId: projectId, taskId: doc.documentID)
    }

    private func setField(_ ref: TaskRef, _ field: String, _ value: Any?) async throws {
        var data = stamp
        data[field] = value ?? FieldValue.delete()
        try await PFPath.task(ref).updateData(data)
    }

    // MARK: Subtasks

    public func addSubtask(_ ref: TaskRef, title: String) async throws {
        try await PFPath.subtasks(ref).document().setData([
            "taskId": ref.taskId, "projectId": ref.projectId, "ownerId": uid,
            "title": title.trimmingCharacters(in: .whitespacesAndNewlines), "isCompleted": false,
            "createdAt": FieldValue.serverTimestamp(), "updatedBy": uid, "updatedAt": FieldValue.serverTimestamp(),
        ])
    }

    public func setSubtask(_ ref: TaskRef, subtaskId: String, completed: Bool) async throws {
        var data = stamp
        data["isCompleted"] = completed
        data["completedBy"] = completed ? uid : FieldValue.delete()
        data["completedAt"] = completed ? FieldValue.serverTimestamp() : FieldValue.delete()
        try await PFPath.subtasks(ref).document(subtaskId).updateData(data)
    }

    public func deleteSubtask(_ ref: TaskRef, subtaskId: String) async throws {
        try await PFPath.subtasks(ref).document(subtaskId).delete()
    }

    // MARK: Comments

    /// Comment with optional explicit mentions (`mentionedUserIds`, contract C1). The server parses
    /// mentions and sends notifications.
    public func addComment(projectId: String, targetId: String, targetType: String = "task", content: String,
                           mentionedUserIds: [String], photoURL: String?) async throws {
        var data: [String: Any] = [
            "projectId": projectId, "targetId": targetId, "targetType": targetType,
            "userId": uid, "userDisplayName": actorName, "content": content,
            "createdAt": FieldValue.serverTimestamp(), "tenantId": tenantId,
            "mentionedUserIds": mentionedUserIds,
        ]
        data.merge(stamp) { _, new in new }
        if let photoURL { data["userPhotoURL"] = photoURL }
        try await PFPath.comments(tenantId, projectId).document().setData(data)
    }

    // MARK: Personal tasks

    @discardableResult
    public func createPersonalTask(title: String, dueDate: FlexDate?, scheduledDate: FlexDate? = nil, priority: TaskPriority?) async throws -> String {
        let doc = PFPath.personalTasks(tenantId, uid).document()
        var data: [String: Any] = [
            "ownerId": uid, "tenantId": tenantId,
            "title": title.trimmingCharacters(in: .whitespacesAndNewlines),
            "isCompleted": false, "status": TaskStatus.open.rawValue,
            "priority": (priority ?? .medium).rawValue,
            "createdAt": FieldValue.serverTimestamp(),
        ]
        if let dueDate { data["dueDate"] = dueDate.webString }
        if let scheduledDate { data["scheduledDate"] = scheduledDate.webString }
        try await doc.setData(data)
        return doc.documentID
    }

    public func updatePersonalTask(_ id: String, _ fields: [String: Any?]) async throws {
        var data: [String: Any] = [:]
        for (key, value) in fields { data[key] = value ?? FieldValue.delete() }
        try await PFPath.personalTasks(tenantId, uid).document(id).updateData(data)
    }

    public func setPersonalCompleted(_ id: String, _ completed: Bool) async throws {
        try await updatePersonalTask(id, [
            "isCompleted": completed,
            "status": completed ? TaskStatus.done.rawValue : TaskStatus.open.rawValue,
            "completedAt": completed ? FieldValue.serverTimestamp() : nil,
        ])
    }

    public func deletePersonalTask(_ id: String) async throws {
        try await PFPath.personalTasks(tenantId, uid).document(id).delete()
    }

    // MARK: Inbox

    public func markRead(_ item: InboxItem, _ read: Bool = true) async throws {
        try await PFPath.notifications(item.tenantId).document(item.id).updateData(["read": read])
    }

    public func markAllRead(_ items: [InboxItem]) async throws {
        let batch = PFFirebase.db.batch()
        for item in items where !item.read {
            batch.updateData(["read": true], forDocument: PFPath.notifications(item.tenantId).document(item.id))
        }
        try await batch.commit()
    }

    public func deleteNotification(_ item: InboxItem) async throws {
        try await PFPath.notifications(item.tenantId).document(item.id).delete()
    }
}

/// Focus and pins on `users/{uid}` (contract C5): pins change inside a transaction so concurrent
/// web/iOS edits never overwrite each other.
@MainActor
public struct FocusActions {
    public let uid: String

    public init(uid: String) { self.uid = uid }

    public func setFocus(_ focus: FocusState?) async throws {
        var data: [String: Any] = ["updatedAt": FieldValue.serverTimestamp()]
        data["focusState"] = focus?.firestoreValue ?? NSNull()
        data["focusItemId"] = focus?.itemId ?? NSNull()
        try await PFPath.user(uid).setData(data, merge: true)
    }

    public func mutatePins(_ change: @escaping @Sendable ([[String: Any]]) -> [[String: Any]]) async throws {
        let ref = PFPath.user(uid)
        _ = try await PFFirebase.db.runTransaction { transaction, errorPointer in
            do {
                let snapshot = try transaction.getDocument(ref)
                let current = (snapshot.data()?["pinnedItems"] as? [[String: Any]]) ?? []
                transaction.setData(["pinnedItems": change(current)], forDocument: ref, merge: true)
            } catch {
                errorPointer?.pointee = error as NSError
            }
            return nil
        }
    }

    public func pin(_ item: PinnedItem) async throws {
        try await mutatePins { current in
            current.filter { ($0["id"] as? String) != item.id } + [item.firestoreValue]
        }
    }

    public func unpin(_ id: String) async throws {
        try await mutatePins { current in current.filter { ($0["id"] as? String) != id } }
    }
}

/// Profile-level writes: preferences, devices, push and Live Activity tokens (contracts C3–C5).
@MainActor
public struct ProfileActions {
    public let uid: String

    public init(uid: String) { self.uid = uid }

    public func setNotificationPrefs(_ prefs: NotificationPrefs) async throws {
        try await PFPath.user(uid).setData(["notificationPrefs": prefs.firestoreValue], merge: true)
    }

    public func setTheme(_ theme: String) async throws {
        try await PFPath.user(uid).setData(["theme": theme], merge: true)
    }

    public func setLanguage(_ language: String) async throws {
        try await PFPath.user(uid).setData(["language": language], merge: true)
    }

    public func registerFCMToken(_ token: String, deviceId: String, appVersion: String) async throws {
        try await PFPath.user(uid).setData(["fcmTokens": FieldValue.arrayUnion([token]), "fcmUpdatedAt": FieldValue.serverTimestamp()], merge: true)
        try await PFPath.devices(uid).document(deviceId).setData([
            "platform": "ios", "fcmToken": token, "appVersion": appVersion,
            "locale": Locale.current.identifier, "timezone": TimeZone.current.identifier,
            "updatedAt": FieldValue.serverTimestamp(),
        ], merge: true)
    }

    public func unregisterFCMToken(_ token: String, deviceId: String) async throws {
        try await PFPath.user(uid).setData(["fcmTokens": FieldValue.arrayRemove([token])], merge: true)
        try await PFPath.devices(uid).document(deviceId).delete()
    }

    public func setLiveActivityStartToken(_ token: String, deviceId: String) async throws {
        try await PFPath.devices(uid).document(deviceId).setData([
            "platform": "ios", "liveActivityStartToken": token, "updatedAt": FieldValue.serverTimestamp(),
        ], merge: true)
    }

    public func registerLiveActivity(id: String, pushToken: String, deviceId: String, itemId: String, itemType: String) async throws {
        try await PFPath.liveActivities(uid).document(id).setData([
            "deviceId": deviceId, "pushToken": pushToken, "itemId": itemId, "itemType": itemType,
            "updatedAt": FieldValue.serverTimestamp(),
        ])
    }

    public func removeLiveActivity(id: String) async throws {
        try await PFPath.liveActivities(uid).document(id).delete()
    }
}

extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}
