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

struct Tenant: FirestoreConvertible {
    let id: String
    var name: String
    var planTier: String
    var ownerId: String
    var createdAt: Timestamp?
    var updatedAt: Timestamp?
    
    // AI Policy
    var aiHardLimitEnabled: Bool
    var aiIncludedTokensPerSeat: Int
    var aiIncludedImagesPerSeat: Int

    init(id: String, data: [String: Any]) {
        self.id = id
        name = data["name"] as? String ?? "New Workspace"
        planTier = data["planTier"] as? String ?? "Starter"
        ownerId = data["ownerId"] as? String ?? ""
        createdAt = data["createdAt"] as? Timestamp
        updatedAt = data["updatedAt"] as? Timestamp
        
        aiHardLimitEnabled = data["aiHardLimitEnabled"] as? Bool ?? true
        aiIncludedTokensPerSeat = data["aiIncludedTokensPerSeat"] as? Int ?? 1_000_000
        aiIncludedImagesPerSeat = data["aiIncludedImagesPerSeat"] as? Int ?? 50
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "name": name,
            "planTier": planTier,
            "ownerId": ownerId,
            "aiHardLimitEnabled": aiHardLimitEnabled,
            "aiIncludedTokensPerSeat": aiIncludedTokensPerSeat,
            "aiIncludedImagesPerSeat": aiIncludedImagesPerSeat
        ]
        if let createdAt {
            payload["createdAt"] = createdAt
        }
        if let updatedAt {
            payload["updatedAt"] = updatedAt
        }
        return payload
    }
}

struct ProjectFlowFocusState {
    let itemId: String
    let itemType: String
    let title: String
    let projectId: String?
    let tenantId: String?
    let status: String
    let startedAt: String?
    let snoozedUntil: String?
    let blockedAt: String?
    let updatedAt: String?
    let lastAction: String?

    init(data: [String: Any]) {
        itemId = data["itemId"] as? String ?? ""
        itemType = data["itemType"] as? String ?? "task"
        title = data["title"] as? String ?? ""
        projectId = data["projectId"] as? String
        tenantId = data["tenantId"] as? String
        status = data["status"] as? String ?? "active"
        startedAt = data["startedAt"] as? String
        snoozedUntil = data["snoozedUntil"] as? String
        blockedAt = data["blockedAt"] as? String
        updatedAt = data["updatedAt"] as? String
        lastAction = data["lastAction"] as? String
    }

    init(item: PinnedItem, status: String, lastAction: String) {
        itemId = item.id
        itemType = item.type
        title = item.title
        projectId = item.projectId.isEmpty ? nil : item.projectId
        tenantId = item.tenantId
        self.status = status
        startedAt = ISO8601DateFormatter().string(from: Date())
        snoozedUntil = nil
        blockedAt = status == "blocked" ? ISO8601DateFormatter().string(from: Date()) : nil
        updatedAt = ISO8601DateFormatter().string(from: Date())
        self.lastAction = lastAction
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "itemId": itemId,
            "itemType": itemType,
            "title": title,
            "status": status
        ]
        if let projectId {
            payload["projectId"] = projectId
        }
        if let tenantId {
            payload["tenantId"] = tenantId
        }
        if let startedAt {
            payload["startedAt"] = startedAt
        }
        if let snoozedUntil {
            payload["snoozedUntil"] = snoozedUntil
        }
        if let blockedAt {
            payload["blockedAt"] = blockedAt
        }
        if let updatedAt {
            payload["updatedAt"] = updatedAt
        }
        if let lastAction {
            payload["lastAction"] = lastAction
        }
        return payload
    }
}

struct UserProfile: FirestoreConvertible {
    let id: String
    var email: String
    var displayName: String
    var bio: String
    var photoURL: String?
    var fcmTokens: [String]
    var fcmUpdatedAt: Timestamp?
    var pinnedItems: [PinnedItem]
    var focusItemId: String?
    var focusState: ProjectFlowFocusState?

    init(id: String, data: [String: Any]) {
        self.id = id
        email = data["email"] as? String ?? ""
        displayName = data["displayName"] as? String ?? ""
        bio = data["bio"] as? String ?? ""
        photoURL = data["photoURL"] as? String
        fcmTokens = data["fcmTokens"] as? [String] ?? []
        fcmUpdatedAt = data["fcmUpdatedAt"] as? Timestamp
        pinnedItems = (data["pinnedItems"] as? [[String: Any]] ?? []).map { PinnedItem(data: $0) }
        focusItemId = data["focusItemId"] as? String
        if let rawFocusState = data["focusState"] as? [String: Any] {
            focusState = ProjectFlowFocusState(data: rawFocusState)
        } else {
            focusState = nil
        }
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "uid": id,
            "email": email,
            "displayName": displayName,
            "bio": bio
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
        if let focusState {
            payload["focusState"] = focusState.data
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

struct ProjectMember: Identifiable, Equatable {
    let id: String
    var userId: String
    var role: String?
    var joinedAt: Timestamp?
    var invitedBy: String?
    var originIdeaId: String?

    init(userId: String, role: String? = nil, joinedAt: Timestamp? = nil, invitedBy: String? = nil, originIdeaId: String? = nil) {
        self.id = userId
        self.userId = userId
        self.role = role
        self.joinedAt = joinedAt
        self.invitedBy = invitedBy
        self.originIdeaId = originIdeaId
    }

    init(data: [String: Any]) {
        let userId = data["userId"] as? String ?? data["uid"] as? String ?? ""
        self.id = userId
        self.userId = userId
        role = data["role"] as? String
        joinedAt = data["joinedAt"] as? Timestamp
        invitedBy = data["invitedBy"] as? String
        originIdeaId = data["originIdeaId"] as? String
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "userId": userId
        ]
        if let role {
            payload["role"] = role
        }
        if let joinedAt {
            payload["joinedAt"] = joinedAt
        }
        if let invitedBy {
            payload["invitedBy"] = invitedBy
        }
        if let originIdeaId {
            payload["originIdeaId"] = originIdeaId
        }
        return payload
    }
}

struct ProjectLink: Identifiable, Equatable {
    let id: String
    var title: String
    var url: String
    var icon: String?
    var originIdeaId: String?

    init(title: String, url: String, icon: String? = nil, originIdeaId: String? = nil) {
        self.id = "\(title)-\(url)"
        self.title = title
        self.url = url
        self.icon = icon
        self.originIdeaId = originIdeaId
    }

    init(data: [String: Any]) {
        title = data["title"] as? String ?? ""
        url = data["url"] as? String ?? ""
        icon = data["icon"] as? String
        originIdeaId = data["originIdeaId"] as? String
        id = "\(title)-\(url)"
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "title": title,
            "url": url
        ]
        if let icon {
            payload["icon"] = icon
        }
        if let originIdeaId {
            payload["originIdeaId"] = originIdeaId
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
    var coverImage: String?
    var squareIcon: String?
    var modules: [String]
    var visibilityGroupIds: [String]
    var members: [ProjectMember]
    var memberIds: [String]
    var links: [ProjectLink]
    var externalResources: [ProjectLink]
    var createdAt: Timestamp?
    var updatedAt: Timestamp?
    // Web parity fields
    var projectCategory: String?
    var templateId: String?
    var companyProjectId: String?
    var companyProjectRole: String?
    var pausedAt: String?
    var canceledAt: String?
    var githubRepo: String?
    var githubIssueSync: Bool
    var brief: ProjectBrief?
    var healthSnapshot: StoredProjectHealthSnapshot?
    var startupProfile: StartupProfile?
    var startupReadiness: StartupReadiness?

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
        coverImage = data["coverImage"] as? String
        squareIcon = data["squareIcon"] as? String
        modules = data["modules"] as? [String] ?? []
        visibilityGroupIds = data["visibilityGroupIds"] as? [String] ?? []
        members = Project.parseMembers(from: data["members"])
        memberIds = data["memberIds"] as? [String] ?? members.map { $0.userId }
        links = Project.parseLinks(from: data["links"])
        externalResources = Project.parseLinks(from: data["externalResources"])
        createdAt = data["createdAt"] as? Timestamp
        updatedAt = data["updatedAt"] as? Timestamp
        projectCategory = data["projectCategory"] as? String
        templateId = data["templateId"] as? String
        companyProjectId = data["companyProjectId"] as? String
        companyProjectRole = data["companyProjectRole"] as? String
        pausedAt = data["pausedAt"] as? String
        canceledAt = data["canceledAt"] as? String
        githubRepo = data["githubRepo"] as? String
        githubIssueSync = data["githubIssueSync"] as? Bool ?? false
        if let rawBrief = data["brief"] as? [String: Any] {
            brief = ProjectBrief(data: rawBrief)
        } else {
            brief = nil
        }
        if let rawHealth = data["healthSnapshot"] as? [String: Any] {
            healthSnapshot = StoredProjectHealthSnapshot(data: rawHealth)
        } else {
            healthSnapshot = nil
        }
        if let rawStartup = data["startupProfile"] as? [String: Any] {
            startupProfile = StartupProfile(data: rawStartup)
        } else {
            startupProfile = nil
        }
        if let rawReadiness = data["startupReadiness"] as? [String: Any] {
            startupReadiness = StartupReadiness(data: rawReadiness)
        } else {
            startupReadiness = nil
        }
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
        if !members.isEmpty {
            payload["members"] = members.map { $0.data }
        }
        if !memberIds.isEmpty {
            payload["memberIds"] = memberIds
        }
        if !links.isEmpty {
            payload["links"] = links.map { $0.data }
        }
        if !externalResources.isEmpty {
            payload["externalResources"] = externalResources.map { $0.data }
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

    private static func parseMembers(from value: Any?) -> [ProjectMember] {
        guard let raw = value as? [Any] else { return [] }
        return raw.compactMap { entry in
            if let userId = entry as? String {
                return ProjectMember(userId: userId)
            }
            if let data = entry as? [String: Any] {
                return ProjectMember(data: data)
            }
            return nil
        }.filter { !$0.userId.isEmpty }
    }

    private static func parseLinks(from value: Any?) -> [ProjectLink] {
        guard let raw = value as? [[String: Any]] else { return [] }
        return raw.map { ProjectLink(data: $0) }.filter { !$0.title.isEmpty && !$0.url.isEmpty }
    }
}

struct ProjectSubtask: Identifiable, Equatable {
    let id: String
    var title: String
    var isCompleted: Bool

    init(id: String = UUID().uuidString, title: String, isCompleted: Bool = false) {
        self.id = id
        self.title = title
        self.isCompleted = isCompleted
    }

    init(data: [String: Any]) {
        id = data["id"] as? String ?? UUID().uuidString
        title = data["title"] as? String ?? ""
        isCompleted = data["isCompleted"] as? Bool ?? false
    }

    var data: [String: Any] {
        [
            "id": id,
            "title": title,
            "isCompleted": isCompleted
        ]
    }
}

struct UserGroup: FirestoreConvertible {
    let id: String
    var tenantId: String?
    var name: String
    var description: String
    var memberIds: [String]
    var color: String // Hex string

    init(id: String, data: [String: Any]) {
        self.id = id
        tenantId = data["tenantId"] as? String
        name = data["name"] as? String ?? "New Group"
        description = data["description"] as? String ?? ""
        memberIds = data["memberIds"] as? [String] ?? []
        color = data["color"] as? String ?? "#808080"
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "name": name,
            "description": description,
            "memberIds": memberIds,
            "color": color
        ]
        if let tenantId { payload["tenantId"] = tenantId }
        return payload
    }
}

struct ProjectLabel: FirestoreConvertible {
    let id: String
    var tenantId: String?
    var projectId: String?
    var title: String
    var color: String // Hex string

    init(id: String, data: [String: Any]) {
        self.id = id
        tenantId = data["tenantId"] as? String
        projectId = data["projectId"] as? String
        title = data["title"] as? String ?? "New Label"
        color = data["color"] as? String ?? "#808080"
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "title": title,
            "color": color
        ]
        if let tenantId { payload["tenantId"] = tenantId }
        if let projectId { payload["projectId"] = projectId }
        return payload
    }
}

struct ProjectTask: FirestoreConvertible {
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
    var subtasks: [ProjectSubtask]
    var labelIds: [String]
    var createdAt: Timestamp?
    var updatedAt: Timestamp?
    var initiativeId: String?
    var dependencies: [String]
    var sprintId: String?
    var scheduledDate: String
    var linkedIssueId: String?
    var convertedIdeaId: String?
    var codexSessionId: String?
    var codexSessionExternalKey: String?

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
        subtasks = (data["subtasks"] as? [[String: Any]] ?? []).map { ProjectSubtask(data: $0) }
        labelIds = data["labelIds"] as? [String] ?? []
        createdAt = data["createdAt"] as? Timestamp
        updatedAt = data["updatedAt"] as? Timestamp
        initiativeId = data["initiativeId"] as? String
        dependencies = data["dependencies"] as? [String] ?? []
        sprintId = data["sprintId"] as? String
        scheduledDate = data["scheduledDate"] as? String ?? ""
        linkedIssueId = data["linkedIssueId"] as? String
        convertedIdeaId = data["convertedIdeaId"] as? String
        codexSessionId = data["codexSessionId"] as? String
        codexSessionExternalKey = data["codexSessionExternalKey"] as? String
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
            "subtasks": subtasks.map { $0.data },
            "labelIds": labelIds,
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
        if let initiativeId { payload["initiativeId"] = initiativeId }
        if !dependencies.isEmpty { payload["dependencies"] = dependencies }
        if let sprintId { payload["sprintId"] = sprintId }
        if !scheduledDate.isEmpty { payload["scheduledDate"] = scheduledDate }
        if let linkedIssueId { payload["linkedIssueId"] = linkedIssueId }
        if let convertedIdeaId { payload["convertedIdeaId"] = convertedIdeaId }
        if let codexSessionId { payload["codexSessionId"] = codexSessionId }
        if let codexSessionExternalKey { payload["codexSessionExternalKey"] = codexSessionExternalKey }
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
    var impact: String?
    var effort: String?
    var concept: String?
    var keywords: [String]
    var strengths: [String]
    var weaknesses: [String]
    var opportunities: [String]
    var threats: [String]
    var convertedInitiativeId: String?
    var convertedTaskId: String?
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
        impact = data["impact"] as? String
        effort = data["effort"] as? String
        concept = data["concept"] as? String
        keywords = data["keywords"] as? [String] ?? []
        convertedInitiativeId = data["convertedInitiativeId"] as? String
        convertedTaskId = data["convertedTaskId"] as? String
        
        let analysis = data["analysis"] as? [String: Any] ?? [:]
        strengths = analysis["strengths"] as? [String] ?? []
        weaknesses = analysis["weaknesses"] as? [String] ?? []
        opportunities = analysis["opportunities"] as? [String] ?? []
        threats = analysis["threats"] as? [String] ?? []
        
        createdAt = data["createdAt"] as? Timestamp
        updatedAt = data["updatedAt"] as? Timestamp
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "title": title,
            "description": description,
            "type": type,
            "stage": stage,
            "ownerId": ownerId,
            "keywords": keywords
        ]
        if let projectId {
            payload["projectId"] = projectId
        }
        if let impact {
            payload["impact"] = impact
        }
        if let effort {
            payload["effort"] = effort
        }
        if let concept {
            payload["concept"] = concept
        }
        
        let analysis: [String: Any] = [
            "strengths": strengths,
            "weaknesses": weaknesses,
            "opportunities": opportunities,
            "threats": threats
        ]
        payload["analysis"] = analysis
        if let convertedInitiativeId { payload["convertedInitiativeId"] = convertedInitiativeId }
        if let convertedTaskId { payload["convertedTaskId"] = convertedTaskId }
        
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
    var labelIds: [String]
    var dueDate: String
    var githubIssueNumber: Int?
    var githubIssueUrl: String?
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
        labelIds = data["labelIds"] as? [String] ?? []
        dueDate = data["dueDate"] as? String ?? ""
        githubIssueNumber = data["githubIssueNumber"] as? Int
        githubIssueUrl = data["githubIssueUrl"] as? String
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
            "labelIds": labelIds,
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
    var type: String
    var relatedId: String?
    var createdAt: Timestamp?

    init(id: String, data: [String: Any]) {
        self.id = id
        projectId = data["projectId"] as? String ?? ""
        user = data["user"] as? String ?? ""
        action = data["action"] as? String ?? ""
        target = data["target"] as? String ?? ""
        details = data["details"] as? String ?? ""
        type = data["type"] as? String ?? "general"
        relatedId = data["relatedId"] as? String
        createdAt = data["createdAt"] as? Timestamp
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "projectId": projectId,
            "user": user,
            "action": action,
            "target": target,
            "details": details,
            "type": type
        ]
        if let relatedId {
            payload["relatedId"] = relatedId
        }
        if let createdAt {
            payload["createdAt"] = createdAt
        }
        return payload
    }
}

struct GeminiReport: FirestoreConvertible {
    let id: String
    var projectId: String
    var content: String
    var createdAt: Timestamp?
    var createdBy: String
    var userName: String
    var originIdeaId: String?

    init(id: String, data: [String: Any]) {
        self.id = id
        projectId = data["projectId"] as? String ?? ""
        content = data["content"] as? String ?? ""
        createdAt = data["createdAt"] as? Timestamp
        createdBy = data["createdBy"] as? String ?? ""
        userName = data["userName"] as? String ?? ""
        originIdeaId = data["originIdeaId"] as? String
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "projectId": projectId,
            "content": content,
            "createdBy": createdBy,
            "userName": userName
        ]
        if let originIdeaId {
            payload["originIdeaId"] = originIdeaId
        }
        if let createdAt {
            payload["createdAt"] = createdAt
        }
        return payload
    }
}

struct ProjectHealthSnapshotEntry: FirestoreConvertible {
    let id: String
    var projectId: String
    var score: Int
    var status: String
    var createdAt: Timestamp?
    var trend: String?

    init(id: String, data: [String: Any]) {
        self.id = id
        projectId = data["projectId"] as? String ?? ""
        score = data["score"] as? Int ?? 0
        status = data["status"] as? String ?? "normal"
        createdAt = data["createdAt"] as? Timestamp
        trend = data["trend"] as? String
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "projectId": projectId,
            "score": score,
            "status": status
        ]
        if let createdAt {
            payload["createdAt"] = createdAt
        }
        if let trend {
            payload["trend"] = trend
        }
        return payload
    }
}
