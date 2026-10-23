import Foundation
import FirebaseFirestore
import PFData

/// Seed content of the `startup_company_formation` template (tracks, jurisdictions, initiatives, tasks,
/// milestones) with resolved DE/EN copy. Generated from the web config + locales by
/// `scripts/export-startup-seeds.mjs` into `Resources/StartupSeeds.json` (see `ios/README.md`).
struct StartupSeedCatalog: Decodable {
    struct Text: Decodable {
        let de: String
        let en: String
        var current: String { L10n.language == .de ? de : en }
    }
    struct Track: Decodable, Identifiable { let id: String; let sensitive: Bool; let label: Text; let description: Text }
    struct Source: Decodable {
        let id: String, labelKey: String, url: String, publisher: String, lastReviewedAt: String
        /// Stored like the web (`StartupSourceReference`).
        var firestoreValue: [String: Any] {
            ["id": id, "labelKey": labelKey, "url": url, "publisher": publisher, "lastReviewedAt": lastReviewedAt]
        }
    }
    struct Jurisdiction: Decodable, Identifiable {
        let id: String
        let label: Text
        let description: Text
        let advisorReviewRequired: Bool
        let suggestedTrackIds: [String]
        let sources: [Source]
    }
    struct Initiative: Decodable { let id: String; let trackId: String; let priority: String; let title: Text; let description: Text }
    struct SeedTask: Decodable {
        let id: String; let trackId: String; let jurisdictionId: String?; let priority: String
        let sourceReferenceIds: [String]; let title: Text; let description: Text
    }
    struct Milestone: Decodable { let id: String; let trackIds: [String]; let riskRating: String; let title: Text; let description: Text }

    let suggestedTrackIds: [String]
    let tracks: [Track]
    let jurisdictions: [Jurisdiction]
    let initiatives: [Initiative]
    let tasks: [SeedTask]
    let milestones: [Milestone]

    static let shared: StartupSeedCatalog? = {
        guard let url = Bundle.main.url(forResource: "StartupSeeds", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(StartupSeedCatalog.self, from: data)
    }()

    func jurisdiction(_ id: String) -> Jurisdiction? { jurisdictions.first { $0.id == id } }

    /// Jurisdiction preselected from the device region: US, otherwise Germany (the primary market).
    var defaultJurisdictionId: String {
        let region = Locale.current.region?.identifier
        return region == "US" ? "us_generic" : "de_generic"
    }

    /// Template defaults plus what the jurisdiction suggests.
    func defaultTrackIds(jurisdictionId: String) -> Set<String> {
        Set(suggestedTrackIds).union(jurisdiction(jurisdictionId)?.suggestedTrackIds ?? [])
    }

    /// What `seed` will create for the selection (for the summary line).
    func counts(tracks selected: Set<String>, jurisdictionId: String) -> (initiatives: Int, tasks: Int, milestones: Int) {
        (initiatives.filter { selected.contains($0.trackId) }.count,
         tasks.filter { selected.contains($0.trackId) && ($0.jurisdictionId == nil || $0.jurisdictionId == jurisdictionId) }.count,
         milestones.filter { $0.trackIds.contains(where: selected.contains) }.count)
    }

    /// Project-doc fields of the web wizard for company projects (`startupProfile`, `startupReadiness`).
    func projectFields(title: String, jurisdictionId: String, trackIds: Set<String>, targetLaunchDate: String?) -> [String: Any] {
        let jurisdiction = jurisdiction(jurisdictionId)
        let ordered = tracks.map(\.id).filter(trackIds.contains)
        let sensitive = tracks.contains { $0.sensitive && trackIds.contains($0.id) }
        var profile: [String: Any] = [
            "workingName": title, "formationStatus": "idea", "fundingRoute": "undecided",
            "jurisdictionTemplateId": jurisdictionId,
            "jurisdictionSources": (jurisdiction?.sources ?? []).map(\.firestoreValue),
            "advisorReviewRequired": (jurisdiction?.advisorReviewRequired ?? true) || sensitive,
            "regulatedIndustryStatus": "unknown",
            "selectedTrackIds": ordered,
        ]
        if let reviewed = jurisdiction?.sources.first?.lastReviewedAt { profile["jurisdictionSourcesReviewedAt"] = reviewed }
        if let targetLaunchDate, !targetLaunchDate.isEmpty { profile["targetLaunchDate"] = targetLaunchDate }
        let readiness = ["legalStructureDecided", "founderAgreementReady", "ipAssignmentReady", "registrationSubmitted",
                         "registrationConfirmed", "taxSetupReady", "bankAccountReady", "bookkeepingReady", "privacyDocsReady",
                         "requiredPermitsKnown", "launchOfferReady", "firstChannelReady"]
        return ["startupProfile": profile, "startupReadiness": Dictionary(uniqueKeysWithValues: readiness.map { ($0, false) })]
    }

    /// Writes initiatives, milestones, tasks and task labels like web `seedStartupProject` (same fields and
    /// `externalKey`s), in the current app language, in one batch. Throws when the batch fails.
    @MainActor
    func seed(tenantId: String, uid: String, projectId: String, trackIds: Set<String>, jurisdictionId: String) async throws {
        let stamp: [String: Any] = ["updatedBy": uid, "updatedAt": FieldValue.serverTimestamp()]
        let batch = PFFirebase.db.batch()
        let templateId = "startup_company_formation"
        let jurisdictionSources = jurisdiction(jurisdictionId)?.sources ?? []

        var initiativeIds: [String: String] = [:]
        for item in initiatives where trackIds.contains(item.trackId) {
            let doc = PFPath.initiatives(tenantId, projectId).document()
            initiativeIds[item.trackId] = doc.documentID
            var data: [String: Any] = [
                "projectId": projectId, "tenantId": tenantId, "ownerId": uid, "createdBy": uid,
                "title": item.title.current, "description": item.description.current,
                "status": "Planning", "priority": item.priority, "startDate": "", "dueDate": "",
                "assigneeIds": [String](), "assignedGroupIds": [String](), "originIdeaId": "",
                "externalKey": "\(templateId):\(item.id)", "source": "template", "templateId": templateId,
                "templateTrack": item.trackId, "templateSeedId": item.id, "sourceReferences": [[String: Any]](),
                "successMetric": "", "outcome": "", "completedAt": NSNull(), "createdAt": FieldValue.serverTimestamp(),
            ]
            data.merge(stamp) { _, new in new }
            batch.setData(data, forDocument: doc)
        }

        for item in milestones where item.trackIds.contains(where: trackIds.contains) {
            let doc = PFPath.milestones(tenantId, projectId).document()
            batch.setData([
                "projectId": projectId, "tenantId": tenantId, "createdBy": uid, "createdAt": FieldValue.serverTimestamp(),
                "title": item.title.current, "description": item.description.current, "status": "Pending",
                "riskRating": item.riskRating, "source": "template", "templateId": templateId,
                "templateTrack": item.trackIds.first(where: trackIds.contains) ?? item.trackIds[0],
                "templateSeedId": item.id, "externalKey": "\(templateId):\(item.id)",
                "linkedTaskIds": [String](), "linkedInitiativeId": "", "dueDate": "",
            ], forDocument: doc)
        }

        var labelNames = Set<String>()
        for item in tasks where trackIds.contains(item.trackId) && (item.jurisdictionId == nil || item.jurisdictionId == jurisdictionId) {
            let trackLabel = tracks.first { $0.id == item.trackId }?.label.current ?? "Startup"
            let references = jurisdictionSources.filter { item.sourceReferenceIds.contains($0.id) }.map(\.firestoreValue)
            let category = ["Startup", trackLabel]
            labelNames.formUnion(category)
            let doc = PFPath.tasks(tenantId, projectId).document()
            var data: [String: Any] = [
                "projectId": projectId, "tenantId": tenantId, "ownerId": uid, "createdBy": uid,
                "title": item.title.current, "description": item.description.current, "isCompleted": false,
                "dueDate": "", "startDate": "", "assignee": "", "assigneeId": NSNull(), "assigneeIds": [String](),
                "assignedGroupIds": [String](), "priority": item.priority, "category": category, "status": "Open",
                "legacyInitiativeRoot": false, "source": references.isEmpty ? "template" : "official_template",
                "templateId": templateId, "templateTrack": item.trackId, "templateSeedId": item.id,
                "sourceReferences": references, "externalKey": "\(templateId):\(item.id)",
                "createdAt": FieldValue.serverTimestamp(),
            ]
            if let initiativeId = initiativeIds[item.trackId] { data["initiativeId"] = initiativeId }
            data.merge(stamp) { _, new in new }
            batch.setData(data, forDocument: doc)
        }

        // Task labels (web `ensureCategory`).
        for name in labelNames.sorted() {
            batch.setData([
                "projectId": projectId, "tenantId": tenantId, "ownerId": uid, "name": name, "normalized": name.lowercased(),
                "color": "#64748b", "createdAt": FieldValue.serverTimestamp(),
            ], forDocument: PFPath.categories(tenantId, projectId).document())
        }
        try await batch.commit()
    }
}
