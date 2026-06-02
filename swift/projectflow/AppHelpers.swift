import Foundation

enum OpenInWebLink {
    static let baseURL = "https://app.getprojectflow.com"

    static func project(_ projectId: String, path: String = "") -> URL? {
        URL(string: "\(baseURL)/project/\(projectId)\(path)")
    }

    static func finance() -> URL? {
        URL(string: "\(baseURL)/finance")
    }

    static func brainstorm() -> URL? {
        URL(string: "\(baseURL)/brainstorm")
    }

    static func media() -> URL? {
        URL(string: "\(baseURL)/media")
    }
}

enum StartupProjects {
    static func readinessPercent(_ readiness: StartupReadiness?) -> (formation: Int, launch: Int) {
        guard let readiness else { return (0, 0) }
        return (readiness.formationPercent, readiness.launchPercent)
    }

    static func stageLabel(_ stage: String?) -> String {
        guard let stage else { return "Idea" }
        return stage.prefix(1).uppercased() + stage.dropFirst()
    }
}
