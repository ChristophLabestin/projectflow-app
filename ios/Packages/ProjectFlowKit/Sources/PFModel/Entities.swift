import Foundation

// Mirrors of the web entities (`web/types.ts`). Only fields the iOS app reads or writes are modelled;
// everything else stays untouched on the server because writes are field-level updates.

public struct Workspace: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public var name: String
    public var ownerId: String?
    public var modules: [String]

    public init(id: String, fields f: Fields) {
        self.id = id
        name = f.string("name") ?? "Workspace"
        ownerId = f.string("ownerId")
        modules = f.strings("AccessToModules")
    }

    public init(id: String, name: String, ownerId: String? = nil, modules: [String] = []) {
        self.id = id; self.name = name; self.ownerId = ownerId; self.modules = modules
    }
}

public struct Membership: Hashable, Sendable, Codable {
    public let tenantId: String
    public let uid: String
    public var role: WorkspaceRole
    public var roleIds: [String]
    public var groupIds: [String]

    public init(tenantId: String, uid: String, fields f: Fields) {
        self.tenantId = tenantId
        self.uid = uid
        role = WorkspaceRole(raw: f.string("role"))
        roleIds = f.strings("roleIds")
        groupIds = f.strings("groupIds")
    }

    public init(tenantId: String, uid: String, role: WorkspaceRole, roleIds: [String] = [], groupIds: [String] = []) {
        self.tenantId = tenantId; self.uid = uid; self.role = role; self.roleIds = roleIds; self.groupIds = groupIds
    }
}

public struct Person: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public var displayName: String
    public var email: String?
    public var photoURL: String?
    public var title: String?
    public var role: WorkspaceRole?

    public init(id: String, fields f: Fields) {
        self.id = id
        displayName = f.string("displayName") ?? f.string("email") ?? "—"
        email = f.string("email")
        photoURL = f.string("photoURL")
        title = f.string("title")
        role = f.string("role").map(WorkspaceRole.init(raw:))
    }

    public init(id: String, displayName: String, email: String? = nil, photoURL: String? = nil) {
        self.id = id; self.displayName = displayName; self.email = email; self.photoURL = photoURL
    }

    public var initials: String {
        let parts = displayName.split(separator: " ").prefix(2)
        let letters = parts.compactMap(\.first).map(String.init).joined()
        return letters.isEmpty ? "?" : letters.uppercased()
    }
}

public struct ProjectReminder: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public var title: String
    public var remindAt: FlexDate?
    public var isCompleted: Bool
    public var createdBy: String?
    public var recipientIds: [String]
    public var notifyAssignees: Bool
    public var sentAt: FlexDate?

    public init(fields f: Fields) {
        id = f.string("id") ?? UUID().uuidString
        title = f.string("title") ?? ""
        remindAt = f.date("remindAt")
        isCompleted = f.bool("isCompleted") ?? false
        createdBy = f.string("createdBy")
        recipientIds = f.strings("recipientIds")
        notifyAssignees = f.bool("notifyAssignees") ?? false
        sentAt = f.date("sentAt")
    }

    public init(id: String = UUID().uuidString, title: String, remindAt: FlexDate, createdBy: String, notifyAssignees: Bool = false) {
        self.id = id; self.title = title; self.remindAt = remindAt; self.isCompleted = false
        self.createdBy = createdBy; self.recipientIds = [createdBy]; self.notifyAssignees = notifyAssignees; self.sentAt = nil
    }

    public var firestoreValue: [String: Any] {
        var value: [String: Any] = [
            "id": id, "title": title, "isCompleted": isCompleted,
            "recipientIds": recipientIds, "notifyAssignees": notifyAssignees,
        ]
        if let remindAt { value["remindAt"] = remindAt.webString }
        if let createdBy { value["createdBy"] = createdBy }
        if let sentAt { value["sentAt"] = sentAt.webString }
        return value
    }
}

public struct HealthSnapshot: Hashable, Sendable, Codable {
    public var score: Double?
    public var status: String?
    public var trend: String?

    public init(fields f: Fields) {
        score = f.double("score")
        status = f.string("status")
        trend = f.string("trend")
    }

    public init(score: Double?, status: String?, trend: String?) {
        self.score = score; self.status = status; self.trend = trend
    }
}

public struct ProjectMemberRef: Hashable, Sendable, Codable {
    public let userId: String
    public var role: String?
}

public struct Project: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public let tenantId: String
    public var title: String
    public var summary: String
    public var progress: Double
    public var status: ProjectStatus
    public var priority: TaskPriority?
    public var ownerId: String?
    public var coverImage: String?
    public var squareIcon: String?
    public var modules: [ProjectModule]
    public var memberIds: [String]
    public var members: [ProjectMemberRef]
    public var companyProjectId: String?
    public var companyProjectRole: String?
    public var projectCategory: String?
    public var isPrivate: Bool
    public var isPersonal: Bool
    public var dueDate: FlexDate?
    public var startDate: FlexDate?
    public var reminders: [ProjectReminder]
    public var healthSnapshot: HealthSnapshot?
    public var updatedAt: FlexDate?

    public init(id: String, tenantId: String, fields f: Fields) {
        self.id = id
        self.tenantId = f.string("tenantId") ?? tenantId
        title = f.string("title") ?? "—"
        summary = f.string("description") ?? ""
        progress = f.double("progress") ?? 0
        status = ProjectStatus(raw: f.string("status"))
        priority = TaskPriority(raw: f.string("priority"))
        ownerId = f.string("ownerId")
        coverImage = f.string("coverImage")
        squareIcon = f.string("squareIcon")
        let rawModules = f.strings("modules").compactMap(ProjectModule.init(rawValue:))
        modules = rawModules.isEmpty ? [.tasks, .initiatives, .milestones, .activity] : rawModules
        memberIds = f.strings("memberIds")
        members = f.maps("members").compactMap { m in
            guard let uid = m.string("userId") ?? m.string("uid") ?? m.string("id") else { return nil }
            return ProjectMemberRef(userId: uid, role: m.string("role"))
        }
        companyProjectId = f.string("companyProjectId")
        companyProjectRole = f.string("companyProjectRole")
        projectCategory = f.string("projectCategory")
        isPrivate = f.bool("isPrivate") ?? false
        isPersonal = f.bool("isPersonal") ?? false
        dueDate = f.date("dueDate")
        startDate = f.date("startDate")
        reminders = f.maps("reminders").map(ProjectReminder.init(fields:))
        healthSnapshot = f.map("healthSnapshot").map(HealthSnapshot.init(fields:))
        updatedAt = f.date("updatedAt")
    }

    public init(id: String, tenantId: String, title: String, status: ProjectStatus = .active, progress: Double = 0) {
        self.id = id; self.tenantId = tenantId; self.title = title; self.summary = ""; self.progress = progress
        self.status = status; self.priority = nil; self.ownerId = nil; self.coverImage = nil; self.squareIcon = nil
        self.modules = [.tasks, .initiatives, .milestones, .activity]; self.memberIds = []; self.members = []
        self.companyProjectId = nil; self.companyProjectRole = nil; self.projectCategory = nil
        self.isPrivate = false; self.isPersonal = false; self.dueDate = nil; self.startDate = nil
        self.reminders = []; self.healthSnapshot = nil; self.updatedAt = nil
    }

    public var isContainer: Bool {
        projectCategory == "startup_company" || projectCategory == "client_delivery" || companyProjectRole == "company"
    }

    public var monogram: String { String(title.first.map(String.init) ?? "P").uppercased() }
}

public struct WorkTask: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public let projectId: String
    public let tenantId: String
    public var title: String
    public var isCompleted: Bool
    public var status: TaskStatus
    public var priority: TaskPriority?
    public var dueDate: FlexDate?
    public var startDate: FlexDate?
    public var scheduledDate: FlexDate?
    public var assigneeIds: [String]
    public var assignedGroupIds: [String]
    public var ownerId: String?
    public var createdBy: String?
    public var summary: String?
    public var nextStep: String?
    public var blockerNote: String?
    public var reminders: [ProjectReminder]
    public var initiativeId: String?
    public var sprintId: String?
    public var dependencies: [String]
    public var parentTaskId: String?
    public var categories: [String]
    public var createdAt: FlexDate?
    public var completedAt: FlexDate?
    public var updatedAt: FlexDate?

    public init(id: String, projectId: String, tenantId: String, fields f: Fields) {
        self.id = id
        self.projectId = f.string("projectId") ?? projectId
        self.tenantId = f.string("tenantId") ?? tenantId
        title = f.string("title") ?? "—"
        let rawStatus = f.string("status")
        let completed = f.bool("isCompleted") ?? false
        isCompleted = completed || rawStatus == "Done"
        status = isCompleted ? .done : TaskStatus(raw: rawStatus)
        priority = TaskPriority(raw: f.string("priority"))
        dueDate = f.date("dueDate")
        startDate = f.date("startDate")
        scheduledDate = f.date("scheduledDate")
        var assignees = f.strings("assigneeIds")
        if assignees.isEmpty, let legacy = f.string("assigneeId") { assignees = [legacy] }
        assigneeIds = assignees
        assignedGroupIds = f.strings("assignedGroupIds")
        ownerId = f.string("ownerId")
        createdBy = f.string("createdBy")
        summary = f.string("description")
        nextStep = f.string("nextStep")
        blockerNote = f.string("blockerNote")
        reminders = f.maps("reminders").map(ProjectReminder.init(fields:))
        initiativeId = f.string("initiativeId")
        sprintId = f.string("sprintId")
        dependencies = f.strings("dependencies")
        parentTaskId = f.string("parentTaskId")
        categories = f.strings("category")
        createdAt = f.date("createdAt")
        completedAt = f.date("completedAt")
        updatedAt = f.date("updatedAt")
    }

    public init(id: String, projectId: String, tenantId: String, title: String, status: TaskStatus = .open,
                priority: TaskPriority? = nil, dueDate: FlexDate? = nil, scheduledDate: FlexDate? = nil,
                assigneeIds: [String] = []) {
        self.id = id; self.projectId = projectId; self.tenantId = tenantId; self.title = title
        self.isCompleted = status == .done; self.status = status; self.priority = priority
        self.dueDate = dueDate; self.startDate = nil; self.scheduledDate = scheduledDate
        self.assigneeIds = assigneeIds; self.assignedGroupIds = []; self.ownerId = nil; self.createdBy = nil
        self.summary = nil; self.nextStep = nil; self.blockerNote = nil; self.reminders = []
        self.initiativeId = nil; self.sprintId = nil; self.dependencies = []; self.parentTaskId = nil
        self.categories = []; self.createdAt = nil; self.completedAt = nil; self.updatedAt = nil
    }

    /// Effective assignees as the web resolves them: explicit assignees, else the owner.
    public var effectiveAssignees: [String] {
        if !assigneeIds.isEmpty { return assigneeIds }
        return ownerId.map { [$0] } ?? []
    }

    public var ref: TaskRef { TaskRef(tenantId: tenantId, projectId: projectId, taskId: id) }
}

/// Fully qualified task path (`tenants/{t}/projects/{p}/tasks/{id}`).
public struct TaskRef: Hashable, Sendable, Codable {
    public let tenantId: String
    public let projectId: String
    public let taskId: String

    public init(tenantId: String, projectId: String, taskId: String) {
        self.tenantId = tenantId; self.projectId = projectId; self.taskId = taskId
    }

    public var path: String { "tenants/\(tenantId)/projects/\(projectId)/tasks/\(taskId)" }
}

public struct PersonalTask: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public let tenantId: String
    public let ownerId: String
    public var title: String
    public var isCompleted: Bool
    public var status: TaskStatus
    public var priority: TaskPriority?
    public var dueDate: FlexDate?
    public var scheduledDate: FlexDate?
    public var summary: String?
    public var createdAt: FlexDate?
    public var completedAt: FlexDate?

    public init(id: String, tenantId: String, ownerId: String, fields f: Fields) {
        self.id = id
        self.tenantId = tenantId
        self.ownerId = f.string("ownerId") ?? ownerId
        title = f.string("title") ?? "—"
        let completed = f.bool("isCompleted") ?? false
        isCompleted = completed || f.string("status") == "Done"
        status = isCompleted ? .done : TaskStatus(raw: f.string("status"))
        priority = TaskPriority(raw: f.string("priority"))
        dueDate = f.date("dueDate")
        scheduledDate = f.date("scheduledDate")
        summary = f.string("description")
        createdAt = f.date("createdAt")
        completedAt = f.date("completedAt")
    }

    public init(id: String, tenantId: String, ownerId: String, title: String, dueDate: FlexDate? = nil, priority: TaskPriority? = nil) {
        self.id = id; self.tenantId = tenantId; self.ownerId = ownerId; self.title = title
        self.isCompleted = false; self.status = .open; self.priority = priority; self.dueDate = dueDate
        self.scheduledDate = nil; self.summary = nil; self.createdAt = nil; self.completedAt = nil
    }
}

public struct SubTask: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public var title: String
    public var isCompleted: Bool
    public var assigneeId: String?
    public var createdAt: FlexDate?

    public init(id: String, fields f: Fields) {
        self.id = id
        title = f.string("title") ?? ""
        isCompleted = f.bool("isCompleted") ?? false
        assigneeId = f.string("assigneeId")
        createdAt = f.date("createdAt")
    }
}

public struct Initiative: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public let projectId: String
    public let tenantId: String
    public var title: String
    public var summary: String?
    public var statusRaw: String
    public var priority: TaskPriority?
    public var health: InitiativeHealth?
    public var dueDate: FlexDate?
    public var assigneeIds: [String]
    public var color: String?
    public var successMetric: String?
    public var startDate: FlexDate?
    /// Public feedback form (`feedbackForm.enabled` + `feedbackForm.token`), set up on the web.
    public var feedbackEnabled: Bool
    public var feedbackToken: String?

    public init(id: String, projectId: String, tenantId: String, fields f: Fields) {
        self.id = id
        self.projectId = f.string("projectId") ?? projectId
        self.tenantId = f.string("tenantId") ?? tenantId
        title = f.string("title") ?? "—"
        summary = f.string("description")
        statusRaw = f.string("status") ?? "Open"
        priority = TaskPriority(raw: f.string("priority"))
        health = InitiativeHealth(rawValue: f.string("health") ?? "")
        dueDate = f.date("dueDate")
        assigneeIds = f.strings("assigneeIds")
        color = f.string("color")
        successMetric = f.string("successMetric")
        startDate = f.date("startDate")
        feedbackEnabled = f.map("feedbackForm")?.bool("enabled") ?? false
        feedbackToken = f.map("feedbackForm")?.string("token")
    }

    public var tone: StatusTone { statusRaw == "Planning" ? .planning : TaskStatus(raw: statusRaw).tone }
    public var isDone: Bool { statusRaw == "Done" }
}

public struct Milestone: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public var title: String
    public var dueDate: FlexDate?
    public var statusRaw: String
    public var linkedTaskIds: [String]
    public var riskRating: String?
    public var summary: String?
    public var linkedInitiativeId: String?

    public init(id: String, fields f: Fields) {
        self.id = id
        summary = f.string("description")
        linkedInitiativeId = f.string("linkedInitiativeId")
        title = f.string("title") ?? "—"
        dueDate = f.date("dueDate")
        statusRaw = f.string("status") ?? "Pending"
        linkedTaskIds = f.strings("linkedTaskIds")
        riskRating = f.string("riskRating")
    }
}

public struct Sprint: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public var name: String
    public var goal: String?
    public var startDate: FlexDate?
    public var endDate: FlexDate?
    public var statusRaw: String
    public var createdAt: FlexDate?

    public init(id: String, fields f: Fields) {
        self.id = id
        createdAt = f.date("createdAt")
        name = f.string("name") ?? "Sprint"
        goal = f.string("goal")
        startDate = f.date("startDate")
        endDate = f.date("endDate")
        statusRaw = f.string("status") ?? "Planning"
    }
}

public struct Comment: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public var targetId: String
    public var targetType: String
    public var userId: String
    public var userDisplayName: String
    public var userPhotoURL: String?
    public var content: String
    public var createdAt: FlexDate?

    public init(id: String, fields f: Fields) {
        self.id = id
        targetId = f.string("targetId") ?? ""
        targetType = f.string("targetType") ?? "task"
        userId = f.string("userId") ?? ""
        userDisplayName = f.string("userDisplayName") ?? "—"
        userPhotoURL = f.string("userPhotoURL")
        content = f.string("content") ?? ""
        createdAt = f.date("createdAt")
    }
}

public struct ActivityEntry: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public var user: String
    public var userAvatar: String?
    public var action: String
    public var target: String
    public var details: String?
    public var type: String
    public var relatedId: String?
    public var createdAt: FlexDate?

    public init(id: String, fields f: Fields) {
        self.id = id
        user = f.string("user") ?? "—"
        userAvatar = f.string("userAvatar")
        action = f.string("action") ?? ""
        target = f.string("target") ?? ""
        details = f.string("details")
        type = f.string("type") ?? "task"
        relatedId = f.string("relatedId")
        createdAt = f.date("createdAt")
    }
}

public struct InboxItem: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public let tenantId: String
    public var kind: NotificationKind
    public var title: String
    public var message: String
    public var read: Bool
    public var createdAt: FlexDate?
    public var projectId: String?
    public var taskId: String?
    public var initiativeId: String?
    public var commentId: String?
    public var inviteId: String?
    public var actorId: String?
    public var actorName: String?
    public var actorPhotoURL: String?

    public init(id: String, tenantId: String, fields f: Fields) {
        self.id = id
        self.tenantId = tenantId
        kind = NotificationKind(raw: f.string("type"))
        title = f.string("title") ?? ""
        message = f.string("message") ?? ""
        read = f.bool("read") ?? false
        createdAt = f.date("createdAt")
        projectId = f.string("projectId")
        taskId = f.string("taskId")
        initiativeId = f.string("initiativeId")
        commentId = f.string("commentId")
        inviteId = f.string("inviteId")
        actorId = f.string("actorId")
        actorName = f.string("actorName")
        actorPhotoURL = f.string("actorPhotoURL")
    }
}

public struct FocusState: Hashable, Sendable, Codable {
    public var itemId: String
    public var itemType: FocusItemType
    public var title: String
    public var projectId: String?
    public var tenantId: String?
    public var status: FocusStatus
    public var startedAt: FlexDate?
    public var snoozedUntil: FlexDate?
    public var blockedAt: FlexDate?
    public var lastAction: FocusLastAction?

    public init?(fields f: Fields?) {
        guard let f, let itemId = f.string("itemId") else { return nil }
        self.itemId = itemId
        itemType = FocusItemType(rawValue: f.string("itemType") ?? "task") ?? .task
        title = f.string("title") ?? ""
        projectId = f.string("projectId")
        tenantId = f.string("tenantId")
        status = FocusStatus(rawValue: f.string("status") ?? "active") ?? .active
        startedAt = f.date("startedAt")
        snoozedUntil = f.date("snoozedUntil")
        blockedAt = f.date("blockedAt")
        lastAction = f.string("lastAction").flatMap(FocusLastAction.init(rawValue:))
    }

    public init(itemId: String, itemType: FocusItemType, title: String, projectId: String?, tenantId: String?,
                status: FocusStatus = .active, startedAt: FlexDate?, lastAction: FocusLastAction = .started) {
        self.itemId = itemId; self.itemType = itemType; self.title = title; self.projectId = projectId
        self.tenantId = tenantId; self.status = status; self.startedAt = startedAt; self.snoozedUntil = nil
        self.blockedAt = nil; self.lastAction = lastAction
    }

    public var firestoreValue: [String: Any] {
        var value: [String: Any] = [
            "itemId": itemId, "itemType": itemType.rawValue, "title": title, "status": status.rawValue,
            "updatedAt": FlexDate(instant: Date()).webString,
        ]
        if let projectId { value["projectId"] = projectId }
        if let tenantId { value["tenantId"] = tenantId }
        if let startedAt { value["startedAt"] = startedAt.webString }
        if let snoozedUntil { value["snoozedUntil"] = snoozedUntil.webString }
        if let blockedAt { value["blockedAt"] = blockedAt.webString }
        if let lastAction { value["lastAction"] = lastAction.rawValue }
        return value
    }
}

public struct PinnedItem: Identifiable, Hashable, Sendable, Codable {
    public var id: String
    public var type: FocusItemType
    public var title: String
    public var projectId: String?
    public var tenantId: String?
    public var priority: String?
    public var isCompleted: Bool

    public init(fields f: Fields) {
        id = f.string("id") ?? ""
        type = FocusItemType(rawValue: f.string("type") ?? "task") ?? .task
        title = f.string("title") ?? ""
        projectId = f.string("projectId")
        tenantId = f.string("tenantId")
        priority = f.string("priority")
        isCompleted = f.bool("isCompleted") ?? false
    }

    public init(id: String, type: FocusItemType, title: String, projectId: String?, tenantId: String?, priority: String? = nil) {
        self.id = id; self.type = type; self.title = title; self.projectId = projectId; self.tenantId = tenantId
        self.priority = priority; self.isCompleted = false
    }

    public var firestoreValue: [String: Any] {
        var value: [String: Any] = ["id": id, "type": type.rawValue, "title": title, "isCompleted": isCompleted]
        if let projectId { value["projectId"] = projectId }
        if let tenantId { value["tenantId"] = tenantId }
        if let priority { value["priority"] = priority }
        return value
    }
}

public struct NotificationPrefs: Hashable, Sendable, Codable {
    public struct Channel: Hashable, Sendable, Codable {
        public var assignments: Bool
        public var mentions: Bool
        public var comments: Bool
        public var due: Bool
        public var reminders: Bool
    }

    public struct Nudge: Hashable, Sendable, Codable {
        public var enabled: Bool
        public var time: String
    }

    public var timezone: String
    public var push: Channel
    public var email: Channel
    public var morningBriefing: Nudge
    public var dayClose: Nudge

    public init(fields f: Fields?) {
        let f = f ?? Fields([:])
        timezone = f.string("timezone") ?? TimeZone.current.identifier
        let p = f.map("push")
        push = Channel(assignments: p?.bool("assignments") ?? true, mentions: p?.bool("mentions") ?? true,
                       comments: p?.bool("comments") ?? true, due: p?.bool("due") ?? true, reminders: p?.bool("reminders") ?? true)
        let e = f.map("email")
        email = Channel(assignments: e?.bool("assignments") ?? true, mentions: e?.bool("mentions") ?? true,
                        comments: e?.bool("comments") ?? false, due: e?.bool("due") ?? false, reminders: e?.bool("reminders") ?? false)
        let mb = f.map("morningBriefing")
        morningBriefing = Nudge(enabled: mb?.bool("enabled") ?? false, time: mb?.string("time") ?? "08:00")
        let dc = f.map("dayClose")
        dayClose = Nudge(enabled: dc?.bool("enabled") ?? false, time: dc?.string("time") ?? "17:30")
    }

    public var firestoreValue: [String: Any] {
        func channel(_ c: Channel) -> [String: Any] {
            ["assignments": c.assignments, "mentions": c.mentions, "comments": c.comments, "due": c.due, "reminders": c.reminders]
        }
        return [
            "timezone": timezone,
            "push": channel(push),
            "email": channel(email),
            "morningBriefing": ["enabled": morningBriefing.enabled, "time": morningBriefing.time],
            "dayClose": ["enabled": dayClose.enabled, "time": dayClose.time],
        ]
    }
}

public struct UserProfile: Identifiable, Hashable, Sendable, Codable {
    public let id: String
    public var email: String?
    public var displayName: String
    public var photoURL: String?
    public var title: String?
    public var language: String?
    public var theme: String?
    public var pinnedItems: [PinnedItem]
    public var focus: FocusState?
    public var notificationPrefs: NotificationPrefs

    public init(id: String, fields f: Fields) {
        self.id = id
        email = f.string("email")
        displayName = f.string("displayName") ?? f.string("email") ?? "—"
        photoURL = f.string("photoURL")
        title = f.string("title")
        language = f.string("language")
        theme = f.string("theme")
        pinnedItems = f.maps("pinnedItems").filter { !$0.raw.isEmpty }.map(PinnedItem.init(fields:))
        focus = FocusState(fields: f.map("focusState"))
        notificationPrefs = NotificationPrefs(fields: f.map("notificationPrefs"))
    }

    public var initials: String { Person(id: id, displayName: displayName).initials }
}
