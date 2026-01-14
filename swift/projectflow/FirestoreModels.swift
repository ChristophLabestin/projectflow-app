import Foundation
import FirebaseFirestore

protocol FirestoreConvertible: Identifiable {
    init(id: String, data: [String: Any])
    var data: [String: Any] { get }
}

extension FirestoreConvertible {
    init(snapshot: DocumentSnapshot) {
        self.init(id: snapshot.documentID, data: snapshot.data() ?? [:])
    }
}

struct UserProfile: FirestoreConvertible {
    let id: String
    var email: String
    var displayName: String
    var photoURL: String?
    var fcmTokens: [String]
    var fcmUpdatedAt: Timestamp?
    var pinnedItems: [PinnedItem]
    var focusItemId: String?

    init(id: String, data: [String: Any]) {
        self.id = id
        email = data["email"] as? String ?? ""
        displayName = data["displayName"] as? String ?? ""
        photoURL = data["photoURL"] as? String
        fcmTokens = data["fcmTokens"] as? [String] ?? []
        fcmUpdatedAt = data["fcmUpdatedAt"] as? Timestamp
        pinnedItems = (data["pinnedItems"] as? [[String: Any]] ?? []).map { PinnedItem(data: $0) }
        focusItemId = data["focusItemId"] as? String
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "uid": id,
            "email": email,
            "displayName": displayName
        ]
        if let photoURL {
            payload["photoURL"] = photoURL
        }
        if !fcmTokens.isEmpty {
            payload["fcmTokens"] = fcmTokens
        }
        if let fcmUpdatedAt {
            payload["fcmUpdatedAt"] = fcmUpdatedAt
        }
        if !pinnedItems.isEmpty {
            payload["pinnedItems"] = pinnedItems.map { $0.data }
        }
        if let focusItemId {
            payload["focusItemId"] = focusItemId
        }
        return payload
    }
}

struct PinnedItem: Identifiable {
    let id: String
    let type: String
    let title: String
    let projectId: String
    let tenantId: String?
    let priority: String?
    let isCompleted: Bool?

    init(
        id: String,
        type: String,
        title: String,
        projectId: String,
        tenantId: String?,
        priority: String?,
        isCompleted: Bool?
    ) {
        self.id = id
        self.type = type
        self.title = title
        self.projectId = projectId
        self.tenantId = tenantId
        self.priority = priority
        self.isCompleted = isCompleted
    }

    init(data: [String: Any]) {
        id = data["id"] as? String ?? ""
        type = data["type"] as? String ?? "task"
        title = data["title"] as? String ?? ""
        projectId = data["projectId"] as? String ?? ""
        tenantId = data["tenantId"] as? String
        priority = data["priority"] as? String
        isCompleted = data["isCompleted"] as? Bool
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "id": id,
            "type": type,
            "title": title,
            "projectId": projectId
        ]
        if let tenantId {
            payload["tenantId"] = tenantId
        }
        if let priority {
            payload["priority"] = priority
        }
        if let isCompleted {
            payload["isCompleted"] = isCompleted
        }
        return payload
    }
}

struct TenantMembership: FirestoreConvertible {
    let id: String
    var role: String
    var joinedAt: Timestamp?
    var groupIds: [String]
    var pinnedProjectId: String?

    init(id: String, data: [String: Any]) {
        self.id = id
        role = data["role"] as? String ?? "Member"
        joinedAt = data["joinedAt"] as? Timestamp
        groupIds = data["groupIds"] as? [String] ?? []
        pinnedProjectId = data["pinnedProjectId"] as? String
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "uid": id,
            "role": role
        ]
        if let joinedAt {
            payload["joinedAt"] = joinedAt
        }
        if !groupIds.isEmpty {
            payload["groupIds"] = groupIds
        }
        if let pinnedProjectId {
            payload["pinnedProjectId"] = pinnedProjectId
        }
        return payload
    }
}

struct Project: FirestoreConvertible {
    let id: String
    var tenantId: String?
    var title: String
    var description: String
    var status: String
    var ownerId: String
    var progress: Double
    var dueDate: String
    var startDate: String
    var priority: String
    var modules: [String]
    var visibilityGroupIds: [String]
    var createdAt: Timestamp?
    var updatedAt: Timestamp?

    init(id: String, data: [String: Any]) {
        self.id = id
        tenantId = data["tenantId"] as? String
        title = data["title"] as? String ?? "Untitled Project"
        description = data["description"] as? String ?? ""
        status = data["status"] as? String ?? "Active"
        ownerId = data["ownerId"] as? String ?? ""
        progress = Project.parseProgress(from: data["progress"])
        dueDate = Project.parseDateString(from: data["dueDate"])
        startDate = Project.parseDateString(from: data["startDate"])
        priority = data["priority"] as? String ?? ""
        modules = data["modules"] as? [String] ?? []
        visibilityGroupIds = data["visibilityGroupIds"] as? [String] ?? []
        createdAt = data["createdAt"] as? Timestamp
        updatedAt = data["updatedAt"] as? Timestamp
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "title": title,
            "description": description,
            "status": status,
            "ownerId": ownerId,
            "progress": progress,
            "dueDate": dueDate,
            "startDate": startDate,
            "priority": priority,
            "modules": modules,
            "visibilityGroupIds": visibilityGroupIds
        ]
        if let tenantId {
            payload["tenantId"] = tenantId
        }
        if let createdAt {
            payload["createdAt"] = createdAt
        }
        if let updatedAt {
            payload["updatedAt"] = updatedAt
        }
        return payload
    }

    private static func parseProgress(from value: Any?) -> Double {
        if let number = value as? NSNumber {
            return number.doubleValue
        }
        if let value = value as? Double {
            return value
        }
        if let value = value as? Int {
            return Double(value)
        }
        return 0
    }

    private static func parseDateString(from value: Any?) -> String {
        if let string = value as? String {
            return string
        }
        if let timestamp = value as? Timestamp {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return formatter.string(from: timestamp.dateValue())
        }
        return ""
    }
}

struct Task: FirestoreConvertible {
    let id: String
    var projectId: String?
    var ownerId: String
    var title: String
    var description: String
    var status: String
    var isCompleted: Bool
    var dueDate: String
    var startDate: String
    var priority: String
    var assigneeIds: [String]
    var assignedGroupIds: [String]
    var createdAt: Timestamp?
    var updatedAt: Timestamp?

    init(id: String, data: [String: Any]) {
        self.id = id
        projectId = data["projectId"] as? String
        ownerId = data["ownerId"] as? String ?? ""
        title = data["title"] as? String ?? "Untitled Task"
        description = data["description"] as? String ?? ""
        status = data["status"] as? String ?? "Open"
        isCompleted = data["isCompleted"] as? Bool ?? false
        dueDate = data["dueDate"] as? String ?? ""
        startDate = data["startDate"] as? String ?? ""
        priority = data["priority"] as? String ?? "Medium"
        assigneeIds = data["assigneeIds"] as? [String] ?? []
        assignedGroupIds = data["assignedGroupIds"] as? [String] ?? []
        createdAt = data["createdAt"] as? Timestamp
        updatedAt = data["updatedAt"] as? Timestamp
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "title": title,
            "description": description,
            "status": status,
            "isCompleted": isCompleted,
            "dueDate": dueDate,
            "startDate": startDate,
            "priority": priority,
            "assigneeIds": assigneeIds,
            "assignedGroupIds": assignedGroupIds,
            "ownerId": ownerId
        ]
        if let projectId {
            payload["projectId"] = projectId
        }
        if let createdAt {
            payload["createdAt"] = createdAt
        }
        if let updatedAt {
            payload["updatedAt"] = updatedAt
        }
        return payload
    }
}

struct Flow: FirestoreConvertible {
    let id: String
    var projectId: String?
    var ownerId: String
    var title: String
    var description: String
    var type: String
    var stage: String
    var createdAt: Timestamp?
    var updatedAt: Timestamp?

    init(id: String, data: [String: Any]) {
        self.id = id
        projectId = data["projectId"] as? String
        ownerId = data["ownerId"] as? String ?? ""
        title = data["title"] as? String ?? "Untitled Flow"
        description = data["description"] as? String ?? ""
        type = data["type"] as? String ?? "Feature"
        stage = data["stage"] as? String ?? "Brainstorm"
        createdAt = data["createdAt"] as? Timestamp
        updatedAt = data["updatedAt"] as? Timestamp
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "title": title,
            "description": description,
            "type": type,
            "stage": stage,
            "ownerId": ownerId
        ]
        if let projectId {
            payload["projectId"] = projectId
        }
        if let createdAt {
            payload["createdAt"] = createdAt
        }
        if let updatedAt {
            payload["updatedAt"] = updatedAt
        }
        return payload
    }
}

struct Issue: FirestoreConvertible {
    let id: String
    var projectId: String?
    var ownerId: String
    var title: String
    var description: String
    var status: String
    var priority: String
    var reporterId: String
    var assigneeIds: [String]
    var dueDate: String
    var createdAt: Timestamp?
    var updatedAt: Timestamp?

    init(id: String, data: [String: Any]) {
        self.id = id
        projectId = data["projectId"] as? String
        ownerId = data["ownerId"] as? String ?? ""
        title = data["title"] as? String ?? "Untitled Issue"
        description = data["description"] as? String ?? ""
        status = data["status"] as? String ?? "Open"
        priority = data["priority"] as? String ?? "Medium"
        reporterId = data["reporterId"] as? String ?? ""
        assigneeIds = data["assigneeIds"] as? [String] ?? []
        dueDate = data["dueDate"] as? String ?? ""
        createdAt = data["createdAt"] as? Timestamp
        updatedAt = data["updatedAt"] as? Timestamp
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "title": title,
            "description": description,
            "status": status,
            "priority": priority,
            "reporterId": reporterId,
            "assigneeIds": assigneeIds,
            "dueDate": dueDate,
            "ownerId": ownerId
        ]
        if let projectId {
            payload["projectId"] = projectId
        }
        if let createdAt {
            payload["createdAt"] = createdAt
        }
        if let updatedAt {
            payload["updatedAt"] = updatedAt
        }
        return payload
    }
}

struct Milestone: FirestoreConvertible {
    let id: String
    var projectId: String
    var title: String
    var description: String
    var dueDate: String
    var status: String
    var createdAt: Timestamp?
    var createdBy: String
    var tenantId: String?

    init(id: String, data: [String: Any]) {
        self.id = id
        projectId = data["projectId"] as? String ?? ""
        title = data["title"] as? String ?? "Untitled Milestone"
        description = data["description"] as? String ?? ""
        dueDate = Milestone.parseDateString(from: data["dueDate"])
        status = data["status"] as? String ?? "Pending"
        createdAt = data["createdAt"] as? Timestamp
        createdBy = data["createdBy"] as? String ?? ""
        tenantId = data["tenantId"] as? String
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "projectId": projectId,
            "title": title,
            "description": description,
            "dueDate": dueDate,
            "status": status,
            "createdBy": createdBy
        ]
        if let tenantId {
            payload["tenantId"] = tenantId
        }
        if let createdAt {
            payload["createdAt"] = createdAt
        }
        return payload
    }

    private static func parseDateString(from value: Any?) -> String {
        if let string = value as? String {
            return string
        }
        if let timestamp = value as? Timestamp {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return formatter.string(from: timestamp.dateValue())
        }
        return ""
    }
}

struct Sprint: FirestoreConvertible {
    let id: String
    var projectId: String
    var name: String
    var goal: String
    var startDate: String
    var endDate: String
    var status: String
    var createdAt: Timestamp?
    var createdBy: String
    var updatedAt: Timestamp?
    var tenantId: String?

    init(id: String, data: [String: Any]) {
        self.id = id
        projectId = data["projectId"] as? String ?? ""
        name = data["name"] as? String ?? "Sprint"
        goal = data["goal"] as? String ?? ""
        startDate = Sprint.parseDateString(from: data["startDate"])
        endDate = Sprint.parseDateString(from: data["endDate"])
        status = data["status"] as? String ?? "Planning"
        createdAt = data["createdAt"] as? Timestamp
        createdBy = data["createdBy"] as? String ?? ""
        updatedAt = data["updatedAt"] as? Timestamp
        tenantId = data["tenantId"] as? String
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "projectId": projectId,
            "name": name,
            "goal": goal,
            "startDate": startDate,
            "endDate": endDate,
            "status": status,
            "createdBy": createdBy
        ]
        if let tenantId {
            payload["tenantId"] = tenantId
        }
        if let createdAt {
            payload["createdAt"] = createdAt
        }
        if let updatedAt {
            payload["updatedAt"] = updatedAt
        }
        return payload
    }

    private static func parseDateString(from value: Any?) -> String {
        if let string = value as? String {
            return string
        }
        if let timestamp = value as? Timestamp {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return formatter.string(from: timestamp.dateValue())
        }
        return ""
    }
}

struct NotificationItem: FirestoreConvertible {
    let id: String
    var userId: String
    var type: String
    var title: String
    var message: String
    var read: Bool
    var createdAt: Timestamp?
    var projectId: String?
    var taskId: String?
    var issueId: String?
    var actorId: String?
    var actorName: String?
    var actorPhotoURL: String?

    init(id: String, data: [String: Any]) {
        self.id = id
        userId = data["userId"] as? String ?? ""
        type = data["type"] as? String ?? "general"
        title = data["title"] as? String ?? ""
        message = data["message"] as? String ?? ""
        read = data["read"] as? Bool ?? false
        createdAt = data["createdAt"] as? Timestamp
        projectId = data["projectId"] as? String
        taskId = data["taskId"] as? String
        issueId = data["issueId"] as? String
        actorId = data["actorId"] as? String
        actorName = data["actorName"] as? String
        actorPhotoURL = data["actorPhotoURL"] as? String
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "userId": userId,
            "type": type,
            "title": title,
            "message": message,
            "read": read
        ]
        if let createdAt {
            payload["createdAt"] = createdAt
        }
        if let projectId {
            payload["projectId"] = projectId
        }
        if let taskId {
            payload["taskId"] = taskId
        }
        if let issueId {
            payload["issueId"] = issueId
        }
        if let actorId {
            payload["actorId"] = actorId
        }
        if let actorName {
            payload["actorName"] = actorName
        }
        if let actorPhotoURL {
            payload["actorPhotoURL"] = actorPhotoURL
        }
        return payload
    }
}

struct ActivityItem: FirestoreConvertible {
    let id: String
    var projectId: String
    var user: String
    var action: String
    var target: String
    var details: String
    var createdAt: Timestamp?

    init(id: String, data: [String: Any]) {
        self.id = id
        projectId = data["projectId"] as? String ?? ""
        user = data["user"] as? String ?? ""
        action = data["action"] as? String ?? ""
        target = data["target"] as? String ?? ""
        details = data["details"] as? String ?? ""
        createdAt = data["createdAt"] as? Timestamp
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "projectId": projectId,
            "user": user,
            "action": action,
            "target": target,
            "details": details
        ]
        if let createdAt {
            payload["createdAt"] = createdAt
        }
        return payload
    }
}
