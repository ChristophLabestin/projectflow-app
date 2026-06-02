import Foundation
import FirebaseFirestore

// MARK: - Extended domain models (web parity)

struct ProjectBrief {
    var objective: String
    var successCriteria: [String]
    var scope: String
    var decisionOwner: String
    var cadence: String

    init(data: [String: Any]) {
        objective = data["objective"] as? String ?? ""
        successCriteria = data["successCriteria"] as? [String] ?? []
        scope = data["scope"] as? String ?? ""
        decisionOwner = data["decisionOwner"] as? String ?? ""
        cadence = data["cadence"] as? String ?? ""
    }

    var data: [String: Any] {
        var payload: [String: Any] = [:]
        if !objective.isEmpty { payload["objective"] = objective }
        if !successCriteria.isEmpty { payload["successCriteria"] = successCriteria }
        if !scope.isEmpty { payload["scope"] = scope }
        if !decisionOwner.isEmpty { payload["decisionOwner"] = decisionOwner }
        if !cadence.isEmpty { payload["cadence"] = cadence }
        return payload
    }
}

struct StoredProjectHealthSnapshot {
    var score: Int?
    var status: String?
    var trend: String?
    var summary: String?

    init(data: [String: Any]) {
        score = data["score"] as? Int
        status = data["status"] as? String
        trend = data["trend"] as? String
        summary = data["summary"] as? String
    }
}

struct StartupReadiness {
    var legalStructureDecided: Bool
    var bankAccountOpened: Bool
    var taxRegistrationComplete: Bool
    var complianceBaselineMet: Bool
    var productMVPReady: Bool
    var launchMarketingReady: Bool
    var fundingSecured: Bool
    var teamHired: Bool
    var operatingProcessesDefined: Bool
    var customerValidationComplete: Bool
    var ipProtected: Bool
    var launchGateReady: Bool

    init(data: [String: Any]) {
        legalStructureDecided = data["legalStructureDecided"] as? Bool ?? false
        bankAccountOpened = data["bankAccountOpened"] as? Bool ?? false
        taxRegistrationComplete = data["taxRegistrationComplete"] as? Bool ?? false
        complianceBaselineMet = data["complianceBaselineMet"] as? Bool ?? false
        productMVPReady = data["productMVPReady"] as? Bool ?? false
        launchMarketingReady = data["launchMarketingReady"] as? Bool ?? false
        fundingSecured = data["fundingSecured"] as? Bool ?? false
        teamHired = data["teamHired"] as? Bool ?? false
        operatingProcessesDefined = data["operatingProcessesDefined"] as? Bool ?? false
        customerValidationComplete = data["customerValidationComplete"] as? Bool ?? false
        ipProtected = data["ipProtected"] as? Bool ?? false
        launchGateReady = data["launchGateReady"] as? Bool ?? false
    }

    var data: [String: Any] {
        [
            "legalStructureDecided": legalStructureDecided,
            "bankAccountOpened": bankAccountOpened,
            "taxRegistrationComplete": taxRegistrationComplete,
            "complianceBaselineMet": complianceBaselineMet,
            "productMVPReady": productMVPReady,
            "launchMarketingReady": launchMarketingReady,
            "fundingSecured": fundingSecured,
            "teamHired": teamHired,
            "operatingProcessesDefined": operatingProcessesDefined,
            "customerValidationComplete": customerValidationComplete,
            "ipProtected": ipProtected,
            "launchGateReady": launchGateReady
        ]
    }

    var formationPercent: Int {
        let keys: [Bool] = [legalStructureDecided, bankAccountOpened, taxRegistrationComplete, complianceBaselineMet]
        let trueCount = keys.filter { $0 }.count
        return keys.isEmpty ? 0 : Int((Double(trueCount) / Double(keys.count)) * 100)
    }

    var launchPercent: Int {
        let keys: [Bool] = [productMVPReady, launchMarketingReady, customerValidationComplete, launchGateReady]
        let trueCount = keys.filter { $0 }.count
        return keys.isEmpty ? 0 : Int((Double(trueCount) / Double(keys.count)) * 100)
    }
}

struct StartupProfile {
    var stage: String
    var jurisdictionTemplateId: String
    var jurisdictionCountry: String
    var jurisdictionRegion: String
    var businessModel: String
    var fundingRoute: String
    var targetCustomer: String
    var regulatedIndustry: Bool
    var hasCoFounders: Bool
    var hasEmployees: Bool

    init(data: [String: Any]) {
        stage = data["stage"] as? String ?? "idea"
        jurisdictionTemplateId = data["jurisdictionTemplateId"] as? String ?? ""
        jurisdictionCountry = data["jurisdictionCountry"] as? String ?? ""
        jurisdictionRegion = data["jurisdictionRegion"] as? String ?? ""
        businessModel = data["businessModel"] as? String ?? ""
        fundingRoute = data["fundingRoute"] as? String ?? ""
        targetCustomer = data["targetCustomer"] as? String ?? ""
        regulatedIndustry = data["regulatedIndustry"] as? Bool ?? false
        hasCoFounders = data["hasCoFounders"] as? Bool ?? false
        hasEmployees = data["hasEmployees"] as? Bool ?? false
    }

    var data: [String: Any] {
        var payload: [String: Any] = ["stage": stage]
        if !jurisdictionTemplateId.isEmpty { payload["jurisdictionTemplateId"] = jurisdictionTemplateId }
        if !jurisdictionCountry.isEmpty { payload["jurisdictionCountry"] = jurisdictionCountry }
        if !jurisdictionRegion.isEmpty { payload["jurisdictionRegion"] = jurisdictionRegion }
        if !businessModel.isEmpty { payload["businessModel"] = businessModel }
        if !fundingRoute.isEmpty { payload["fundingRoute"] = fundingRoute }
        if !targetCustomer.isEmpty { payload["targetCustomer"] = targetCustomer }
        payload["regulatedIndustry"] = regulatedIndustry
        payload["hasCoFounders"] = hasCoFounders
        payload["hasEmployees"] = hasEmployees
        return payload
    }
}

struct InitiativeFeedbackFormSettings {
    var enabled: Bool
    var token: String
    var title: String?
    var description: String?

    init(data: [String: Any]) {
        enabled = data["enabled"] as? Bool ?? false
        token = data["token"] as? String ?? ""
        title = data["title"] as? String
        description = data["description"] as? String
    }

    var publicURL: String {
        guard !token.isEmpty else { return "" }
        return "https://app.getprojectflow.com/feedback/initiative/\(token)"
    }
}

struct Initiative: FirestoreConvertible {
    let id: String
    var projectId: String
    var tenantId: String
    var ownerId: String
    var title: String
    var description: String
    var status: String
    var priority: String
    var startDate: String
    var dueDate: String
    var assigneeIds: [String]
    var assignedGroupIds: [String]
    var successMetric: String
    var outcome: String
    var health: String
    var feedbackForm: InitiativeFeedbackFormSettings?
    var createdAt: Timestamp?
    var updatedAt: Timestamp?
    var completedAt: Timestamp?

    init(id: String, data: [String: Any]) {
        self.id = id
        projectId = data["projectId"] as? String ?? ""
        tenantId = data["tenantId"] as? String ?? ""
        ownerId = data["ownerId"] as? String ?? ""
        title = data["title"] as? String ?? "Untitled Initiative"
        description = data["description"] as? String ?? ""
        status = data["status"] as? String ?? "Open"
        priority = data["priority"] as? String ?? "Medium"
        startDate = Initiative.parseDateString(from: data["startDate"])
        dueDate = Initiative.parseDateString(from: data["dueDate"])
        assigneeIds = data["assigneeIds"] as? [String] ?? []
        assignedGroupIds = data["assignedGroupIds"] as? [String] ?? []
        successMetric = data["successMetric"] as? String ?? ""
        outcome = data["outcome"] as? String ?? ""
        health = data["health"] as? String ?? InitiativeHealth.onTrack.rawValue
        if let rawForm = data["feedbackForm"] as? [String: Any] {
            feedbackForm = InitiativeFeedbackFormSettings(data: rawForm)
        } else {
            feedbackForm = nil
        }
        createdAt = data["createdAt"] as? Timestamp
        updatedAt = data["updatedAt"] as? Timestamp
        completedAt = data["completedAt"] as? Timestamp
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "projectId": projectId,
            "tenantId": tenantId,
            "ownerId": ownerId,
            "title": title,
            "description": description,
            "status": status,
            "priority": priority,
            "startDate": startDate,
            "dueDate": dueDate,
            "assigneeIds": assigneeIds,
            "assignedGroupIds": assignedGroupIds,
            "health": health
        ]
        if !successMetric.isEmpty { payload["successMetric"] = successMetric }
        if !outcome.isEmpty { payload["outcome"] = outcome }
        if let feedbackForm, feedbackForm.enabled {
            payload["feedbackForm"] = [
                "enabled": feedbackForm.enabled,
                "token": feedbackForm.token
            ]
        }
        if let createdAt { payload["createdAt"] = createdAt }
        if let updatedAt { payload["updatedAt"] = updatedAt }
        if let completedAt { payload["completedAt"] = completedAt }
        return payload
    }

    private static func parseDateString(from value: Any?) -> String {
        if let string = value as? String { return string }
        if let timestamp = value as? Timestamp {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return formatter.string(from: timestamp.dateValue())
        }
        return ""
    }
}

struct PersonalTask: FirestoreConvertible {
    let id: String
    var ownerId: String
    var title: String
    var description: String
    var isCompleted: Bool
    var dueDate: String
    var priority: String
    var status: String
    var scheduledDate: String
    var tenantId: String?
    var source: String?
    var shareCaptureId: String?
    var createdAt: Timestamp?
    var completedAt: Timestamp?

    init(id: String, data: [String: Any]) {
        self.id = id
        ownerId = data["ownerId"] as? String ?? ""
        title = data["title"] as? String ?? "Untitled"
        description = data["description"] as? String ?? ""
        isCompleted = data["isCompleted"] as? Bool ?? false
        dueDate = PersonalTask.parseDateString(from: data["dueDate"])
        priority = data["priority"] as? String ?? "Medium"
        status = data["status"] as? String ?? "Open"
        scheduledDate = PersonalTask.parseDateString(from: data["scheduledDate"])
        tenantId = data["tenantId"] as? String
        source = data["source"] as? String
        shareCaptureId = data["shareCaptureId"] as? String
        createdAt = data["createdAt"] as? Timestamp
        completedAt = data["completedAt"] as? Timestamp
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "title": title,
            "description": description,
            "isCompleted": isCompleted,
            "dueDate": dueDate,
            "priority": priority,
            "status": status,
            "ownerId": ownerId
        ]
        if !scheduledDate.isEmpty { payload["scheduledDate"] = scheduledDate }
        if let tenantId { payload["tenantId"] = tenantId }
        if let source { payload["source"] = source }
        if let shareCaptureId { payload["shareCaptureId"] = shareCaptureId }
        if let createdAt { payload["createdAt"] = createdAt }
        if let completedAt { payload["completedAt"] = completedAt }
        return payload
    }

    private static func parseDateString(from value: Any?) -> String {
        if let string = value as? String { return string }
        if let timestamp = value as? Timestamp {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return formatter.string(from: timestamp.dateValue())
        }
        return ""
    }
}

struct Comment: FirestoreConvertible {
    let id: String
    var projectId: String
    var targetId: String
    var targetType: String
    var userId: String
    var userDisplayName: String
    var userPhotoURL: String?
    var content: String
    var createdAt: Timestamp?

    init(id: String, data: [String: Any]) {
        self.id = id
        projectId = data["projectId"] as? String ?? ""
        targetId = data["targetId"] as? String ?? ""
        targetType = data["targetType"] as? String ?? "task"
        userId = data["userId"] as? String ?? ""
        userDisplayName = data["userDisplayName"] as? String ?? "User"
        userPhotoURL = data["userPhotoURL"] as? String
        content = data["content"] as? String ?? ""
        createdAt = data["createdAt"] as? Timestamp
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "projectId": projectId,
            "targetId": targetId,
            "targetType": targetType,
            "userId": userId,
            "userDisplayName": userDisplayName,
            "content": content
        ]
        if let userPhotoURL { payload["userPhotoURL"] = userPhotoURL }
        if let createdAt { payload["createdAt"] = createdAt }
        return payload
    }
}

struct CodexSession: FirestoreConvertible {
    let id: String
    var projectId: String
    var title: String
    var summary: String
    var externalKey: String
    var status: String
    var createdAt: Timestamp?
    var updatedAt: Timestamp?

    init(id: String, data: [String: Any]) {
        self.id = id
        projectId = data["projectId"] as? String ?? ""
        title = data["title"] as? String ?? "Codex Session"
        summary = data["summary"] as? String ?? ""
        externalKey = data["externalKey"] as? String ?? ""
        status = data["status"] as? String ?? "open"
        createdAt = data["createdAt"] as? Timestamp
        updatedAt = data["updatedAt"] as? Timestamp
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "projectId": projectId,
            "title": title,
            "summary": summary,
            "externalKey": externalKey,
            "status": status
        ]
        if let createdAt { payload["createdAt"] = createdAt }
        if let updatedAt { payload["updatedAt"] = updatedAt }
        return payload
    }
}

struct CodexFollowUp: FirestoreConvertible {
    let id: String
    var projectId: String
    var sessionId: String
    var title: String
    var description: String
    var status: String
    var createdAt: Timestamp?

    init(id: String, data: [String: Any]) {
        self.id = id
        projectId = data["projectId"] as? String ?? ""
        sessionId = data["sessionId"] as? String ?? ""
        title = data["title"] as? String ?? "Follow-up"
        description = data["description"] as? String ?? ""
        status = data["status"] as? String ?? "open"
        createdAt = data["createdAt"] as? Timestamp
    }

    var data: [String: Any] {
        var payload: [String: Any] = [
            "projectId": projectId,
            "sessionId": sessionId,
            "title": title,
            "description": description,
            "status": status
        ]
        if let createdAt { payload["createdAt"] = createdAt }
        return payload
    }
}

struct TenantRole: FirestoreConvertible {
    let id: String
    var name: String
    var allow: [String]
    var deny: [String]
    var isSystem: Bool

    init(id: String, data: [String: Any]) {
        self.id = id
        name = data["name"] as? String ?? id
        allow = data["allow"] as? [String] ?? []
        deny = data["deny"] as? [String] ?? []
        isSystem = data["isSystem"] as? Bool ?? false
    }

    var data: [String: Any] {
        [
            "name": name,
            "allow": allow,
            "deny": deny,
            "isSystem": isSystem
        ]
    }
}

// MARK: - Project helpers

extension Project {
    var isCompanyProject: Bool {
        projectCategory == "startup_company" || templateId == "startup_company_formation"
    }

    var isWorkstream: Bool {
        guard let companyProjectId, !companyProjectId.isEmpty else { return false }
        return !isCompanyProject
    }

    func hasModule(_ module: ProjectModule) -> Bool {
        modules.contains(module.rawValue)
    }

    func enabledNavModules() -> [ProjectModule] {
        let order: [ProjectModule] = [
            .initiatives, .tasks, .sprints, .issues, .ideas, .milestones, .activity
        ]
        return order.filter { hasModule($0) }
    }
}
