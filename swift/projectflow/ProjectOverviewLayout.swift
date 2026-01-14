import Foundation

enum ProjectOverviewTemplateId {
    static let core = "core"
    static let custom = "custom"
}

enum ProjectOverviewCardType: String, CaseIterable, Identifiable {
    case snapshot
    case execution
    case updates
    case resources
    case planning
    case milestones
    case aiInsights
    case team
    case controls

    var id: String { rawValue }

    var title: String {
        switch self {
        case .snapshot: return "Snapshot"
        case .execution: return "Execution"
        case .updates: return "Updates"
        case .resources: return "Resources"
        case .planning: return "Planning"
        case .milestones: return "Milestones"
        case .aiInsights: return "AI Insights"
        case .team: return "Team"
        case .controls: return "Controls"
        }
    }

    var subtitle: String {
        switch self {
        case .snapshot: return "High-level overview of project health and activity."
        case .execution: return "Active tasks, flow spotlight, and issue focus."
        case .updates: return "Recent updates and activity stream."
        case .resources: return "Key links, files, and project resources."
        case .planning: return "Sprint planning and roadmap execution."
        case .milestones: return "Key project milestones and deadlines."
        case .aiInsights: return "AI-generated insights and recommendations."
        case .team: return "Project members and roles."
        case .controls: return "Project settings and administrative controls."
        }
    }

    // Default span in a 12-column grid system (web uses 12 columns).
    // SwiftUI GridItem(.flexible()) usually implies equality or ratio.
    // We'll map these to grid cells.
    var defaultSpan: Int {
        switch self {
        case .snapshot: return 2 // Full width (assuming 2-column grid)
        case .execution: return 2
        case .updates: return 2
        case .resources: return 2
        case .planning: return 1
        case .milestones: return 1
        case .aiInsights: return 1
        case .team: return 1
        case .controls: return 1
        }
    }
}

struct ProjectOverviewCardConfig: Identifiable, Hashable {
    let type: ProjectOverviewCardType
    var isEnabled: Bool
    var span: Int

    var id: String { type.rawValue }

    init(type: ProjectOverviewCardType, isEnabled: Bool = true, span: Int? = nil) {
        self.type = type
        self.isEnabled = isEnabled
        self.span = span ?? type.defaultSpan
    }

    init?(data: [String: Any]) {
        guard let typeRaw = data["type"] as? String,
              let type = ProjectOverviewCardType(rawValue: typeRaw) else {
            return nil
        }
        let isEnabled = data["isEnabled"] as? Bool ?? true
        let span = data["span"] as? Int ?? type.defaultSpan
        self.init(type: type, isEnabled: isEnabled, span: span)
    }

    var data: [String: Any] {
        [
            "type": type.rawValue,
            "isEnabled": isEnabled,
            "span": span
        ]
    }
}

struct ProjectOverviewLayout: Hashable {
    var templateId: String
    var cards: [ProjectOverviewCardConfig]

    static var defaultLayout: ProjectOverviewLayout {
        ProjectOverviewLayout(
            templateId: ProjectOverviewTemplateId.core,
            cards: ProjectOverviewCardType.allCases.map { ProjectOverviewCardConfig(type: $0, isEnabled: true) }
        )
    }

    var enabledCards: [ProjectOverviewCardConfig] {
        cards.filter { $0.isEnabled }
    }

    var templateLabel: String {
        templateId == ProjectOverviewTemplateId.custom ? "Custom" : "Core"
    }

    mutating func normalize() {
        var seen = Set<ProjectOverviewCardType>()
        cards = cards.filter { seen.insert($0.type).inserted }
        let existing = Set(cards.map { $0.type })
        let defaultEnabled = templateId != ProjectOverviewTemplateId.custom
        for type in ProjectOverviewCardType.allCases where !existing.contains(type) {
            cards.append(ProjectOverviewCardConfig(type: type, isEnabled: defaultEnabled))
        }
    }

    static func templateLayout(id: String) -> ProjectOverviewLayout {
        switch id {
        case ProjectOverviewTemplateId.core:
            return defaultLayout
        default:
            return defaultLayout
        }
    }

    static func from(data: [String: Any]) -> ProjectOverviewLayout {
        let templateId = data["templateId"] as? String ?? ProjectOverviewTemplateId.core
        let cardData = data["cards"] as? [[String: Any]] ?? []
        var cards = cardData.compactMap(ProjectOverviewCardConfig.init)
        if cards.isEmpty {
            cards = templateLayout(id: templateId).cards
        }
        var layout = ProjectOverviewLayout(templateId: templateId, cards: cards)
        layout.normalize()
        return layout
    }

    var data: [String: Any] {
        [
            "templateId": templateId,
            "cards": cards.map { $0.data }
        ]
    }
}
