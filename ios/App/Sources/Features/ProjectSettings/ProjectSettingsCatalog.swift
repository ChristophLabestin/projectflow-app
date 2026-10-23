import Foundation
import PFDesign
import PFData
import PFModel

/// Static option lists of the project settings (same values as `web/components/project/ProjectEditModal.tsx`).
enum ProjectSettingsCatalog {
    struct Module: Identifiable {
        let id: String
        let labelKey: String
        var locked = false
    }

    static let modules: [Module] = [
        Module(id: "tasks", labelKey: "projectSettings.module.tasks", locked: true),
        Module(id: "initiatives", labelKey: "projectSettings.module.initiatives"),
        Module(id: "milestones", labelKey: "projectSettings.module.milestones"),
        Module(id: "sprints", labelKey: "projectSettings.module.sprints"),
        Module(id: "activity", labelKey: "projectSettings.module.activity"),
        Module(id: "marketing", labelKey: "projectSettings.module.marketing"),
        Module(id: "accounting", labelKey: "projectSettings.module.accounting"),
    ]

    /// Items of the per-user project navigation (`projectNavPrefs`): the overview is always visible.
    static let navItems: [(id: String, labelKey: String, canHide: Bool, symbol: String)] = [
        ("overview", "projectSettings.nav.overview", false, "square.grid.2x2"),
        ("initiatives", "projectSettings.module.initiatives", true, "target"),
        ("tasks", "projectSettings.module.tasks", true, "checklist"),
        ("sprints", "projectSettings.module.sprints", true, "figure.run"),
        ("milestones", "projectSettings.module.milestones", true, "flag"),
        ("marketing", "projectSettings.module.marketing", true, "megaphone"),
        ("activity", "projectSettings.module.activity", true, "clock.arrow.circlepath"),
    ]

    /// Statuses a project can be set to by hand (paused/canceled go through the lifecycle actions).
    static func statusOptions(current: ProjectStatus, isSoftware: Bool) -> [ProjectStatus] {
        var options: [ProjectStatus] = [.active]
        if isSoftware || current == .inTesting { options.append(.inTesting) }
        options += [.backlog, .planning, .completed, .brainstorming, .review]
        return options
    }

    static let priorities: [TaskPriority] = [.low, .medium, .high, .urgent]
    static let projectStates = ["not specified", "pre-release", "released"]
    static let cadences = ["daily", "weekly", "biweekly", "monthly", "ad-hoc"]
    static let modes = ["explore", "build", "ship", "maintain"]
    static let confidences = ["fixed", "target", "rough", "unknown"]
    static let severities = ["low", "medium", "high"]

    /// Label colours offered when creating a label.
    static let labelColors = ["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6", "#6B7280"]

    static func isSoftware(category: String, templateId: String?, type: String) -> Bool {
        category == "software" || templateId == "software_release" || type == "software"
    }
}

/// Applies the user's project navigation (`projectNavPrefs`) and the project's modules to the cockpit:
/// hidden items and disabled modules disappear, and a custom order moves tabs and plan sections.
struct ProjectNavLayout {
    let prefs: ProjectNavPrefs
    let modules: [ProjectModule]

    func isVisible(_ id: String) -> Bool {
        if id == "overview" { return true }
        // Older projects have no module list: everything is on.
        if !modules.isEmpty, let module = ProjectModule(rawValue: id), !modules.contains(module) { return false }
        return !prefs.hidden.contains(id)
    }

    /// Plan sections in the user's order (the plan's own order when none is set).
    var planSections: [String] {
        ordered(["milestones", "sprints", "initiatives"]).filter(isVisible)
    }

    var showsTasks: Bool { isVisible("tasks") }

    /// Whether the tasks tabs come before the plan tab.
    var tasksBeforePlan: Bool {
        guard !prefs.order.isEmpty, let firstPlan = planSections.first else { return true }
        return rank("tasks") <= rank(firstPlan)
    }

    private func ordered(_ ids: [String]) -> [String] {
        guard !prefs.order.isEmpty else { return ids }
        return ids.enumerated().sorted { (rank($0.element), $0.offset) < (rank($1.element), $1.offset) }.map(\.element)
    }

    private func rank(_ id: String) -> Int { prefs.order.firstIndex(of: id) ?? Int.max }
}
