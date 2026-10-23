import SwiftUI
import PFDesign

/// A command of the search palette: actions ("Aufgabe erstellen") and pages ("Gehe zu").
struct SearchCommand: Identifiable {
    enum Section { case action, page }

    let id: String
    let section: Section
    let title: String
    let systemImage: String
    var keywords: [String] = []
    let run: () -> Void
}

@MainActor
enum SearchCommands {
    /// Web path of the tab the search was opened from (for "Link kopieren").
    static func webPath(for tab: AppTab) -> String {
        switch tab {
        case .today: "/"
        case .work: "/tasks"
        case .projects: "/projects"
        case .inbox: "/notifications"
        }
    }

    static func all(model: AppModel, isDark: Bool, openProjects: @escaping () -> Void) -> [SearchCommand] {
        let router = model.router
        var commands: [SearchCommand] = [
            SearchCommand(id: "newTask", section: .action, title: L10n.t("search.action.newTask"), systemImage: "plus",
                          keywords: ["new", "task", "neu", "aufgabe", "capture", "erfassen"]) {
                router.isSearchActive = false
                CaptureLauncher.present(model: model)
            },
            SearchCommand(id: "openProject", section: .action, title: L10n.t("search.action.openProject"), systemImage: "square.stack.3d.up",
                          keywords: ["project", "projekt", "open", "öffnen"], run: openProjects),
            SearchCommand(id: "theme", section: .action,
                          title: isDark ? L10n.t("search.action.lightMode") : L10n.t("search.action.darkMode"),
                          systemImage: isDark ? "sun.max" : "moon", keywords: ["theme", "design", "dark", "dunkel", "hell", "light", "mode"]) {
                guard let actions = model.profileActions else { return }
                let next = isDark ? "light" : "dark"
                Task { await model.perform { try await actions.setTheme(next) } }
            },
            SearchCommand(id: "copyLink", section: .action, title: L10n.t("search.action.copyLink"), systemImage: "link",
                          keywords: ["link", "copy", "kopieren", "url", "teilen"]) {
                UIPasteboard.general.string = "https://\(SharedConstants.webHost)\(webPath(for: router.tab))"
                PFHaptics.success()
                model.toasts.show(PFToast(L10n.t("common.linkCopied"), style: .success))
            },
        ]
        let pages: [(id: String, title: String, icon: String, tab: AppTab?)] = [
            ("today", L10n.t("tab.today"), "sun.horizon", .today),
            ("work", L10n.t("tab.work"), "checklist", .work),
            ("projects", L10n.t("tab.projects"), "square.stack.3d.up", .projects),
            ("inbox", L10n.t("tab.inbox"), "tray", .inbox),
        ]
        for page in pages {
            commands.append(SearchCommand(id: "page.\(page.id)", section: .page, title: page.title, systemImage: page.icon) {
                if let tab = page.tab { router.select(tab) }
            })
        }
        commands.append(SearchCommand(id: "page.account", section: .page, title: L10n.t("search.page.profile"), systemImage: "person.crop.circle",
                                      keywords: ["account", "konto", "settings", "einstellungen", "profil"]) {
            router.push(.account)
        })
        commands.append(SearchCommand(id: "page.team", section: .page, title: L10n.t("search.page.team"), systemImage: "person.2",
                                      keywords: ["team", "members", "mitglieder"]) {
            router.push(.team)
        })
        return commands
    }
}
