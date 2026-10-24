import Foundation
import Observation
import PFDesign
import PFModel

enum AppTab: String, CaseIterable, Hashable {
    case today, work, projects, inbox
}

/// Every pushable screen. Feature screens are resolved in `RouteDestination`.
enum AppRoute: Hashable {
    case task(TaskRef)
    case personalTask(tenantId: String, id: String)
    case project(tenantId: String, projectId: String)
    case initiative(tenantId: String, projectId: String, initiativeId: String)
    case projectSettings(tenantId: String, projectId: String)
    case account
    case notificationSettings
    case securitySettings
    case aiConnections
    case appearanceSettings
    case team
    /// Profile, workspace settings, roles, groups, member detail (Team package).
    case accountPage(AccountPage)
    case designCatalog
    /// Workspace areas (activity feed: whole workspace or one project).
    case activity(tenantId: String, projectId: String?)
    case insights(tenantId: String)
    case files(tenantId: String)
    case wiki(tenantId: String)
    case flows(tenantId: String)
    case flow(tenantId: String, flowId: String)
    case wikiPage(tenantId: String, docId: String, startEditing: Bool = false)
}

/// Navigation state: selected tab, one stack per tab (+ search), focus room, deep links.
@Observable
final class AppRouter {
    var tab: AppTab = .today
    var isSearchActive = false
    var isFocusRoomOpen = false
    /// iPhone Duo opened: the list column of a list/detail tab is folded away (rail toggle), e.g. for the board.
    var isListColumnHidden = false
    /// Today opens in day-close mode (`/?mode=close`, day_close push).
    var todayMode: TodayMode = .normal
    let stacks: [AppTab: PFNavigationModel<AppRoute>] = Dictionary(uniqueKeysWithValues: AppTab.allCases.map { ($0, PFNavigationModel<AppRoute>()) })
    let searchStack = PFNavigationModel<AppRoute>()
    /// A deep link that arrived before sign-in; replayed once the session is ready.
    var pendingURL: URL?
    /// Opens the capture composer (`projectflow://capture`, Control Center, Action Button). Set by `AppIntentBridge`.
    @ObservationIgnored var onCapture: ((CaptureContext) -> Void)?
    /// "Frag ProjectFlow" requested from outside (`projectflow://ask?q=…`, App Intent); MainShell opens the sheet.
    var pendingAsk: String?
    /// `/invite/<tenantId>/<inviteId>` waiting to be shown (Onboarding feature presents the accept sheet).
    var pendingInvite: InviteLink?

    enum TodayMode: Equatable { case normal, dayClose }

    var current: PFNavigationModel<AppRoute> { isSearchActive ? searchStack : stacks[tab]! }
    var isDeep: Bool { !current.path.isEmpty }

    func select(_ tab: AppTab) {
        isSearchActive = false
        self.tab = tab
    }

    func push(_ route: AppRoute) { current.push(route) }
    func pop() { current.pop() }

    func reselect(_ tab: AppTab) { stacks[tab]?.popToRoot() }

    func openSearch() { isSearchActive = true }

    /// Opens a route from outside (push, widget, deep link): switches to the matching tab first.
    func open(_ route: AppRoute, in tab: AppTab? = nil) {
        isFocusRoomOpen = false
        if let tab { select(tab) }
        current.replace(with: [route])
    }

    /// Parses web routes (contract C8) and `projectflow://` URLs.
    /// Returns false when the URL needs a signed-in session that is not ready yet.
    @discardableResult
    func handle(url: URL, activeTenant: String?) -> Bool {
        guard let activeTenant else {
            pendingURL = url
            return false
        }
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let tenant = components?.queryItems?.first(where: { $0.name == "tenant" })?.value ?? activeTenant
        var parts = url.pathComponents.filter { $0 != "/" }
        if url.scheme == "projectflow", let host = url.host() { parts.insert(host, at: 0) }
        switch parts.first {
        case "project" where parts.count >= 2:
            let projectId = parts[1]
            if parts.count >= 4, parts[2] == "tasks" {
                open(.task(TaskRef(tenantId: tenant, projectId: projectId, taskId: parts[3])), in: .work)
            } else if parts.count >= 4, parts[2] == "initiatives" {
                open(.initiative(tenantId: tenant, projectId: projectId, initiativeId: parts[3]), in: .projects)
            } else if parts.count >= 4, parts[2] == "wiki" {
                open(.wikiPage(tenantId: tenant, docId: parts[3]), in: .projects)
            } else if parts.count >= 3, parts[2] == "activity" {
                open(.activity(tenantId: tenant, projectId: projectId), in: .projects)
            } else {
                open(.project(tenantId: tenant, projectId: projectId), in: .projects)
            }
        case "tasks":
            select(.work)
        case "projects":
            select(.projects)
        case "activity":
            open(.activity(tenantId: tenant, projectId: nil), in: .projects)
        case "insights":
            open(.insights(tenantId: tenant), in: .projects)
        case "files", "media":
            open(.files(tenantId: tenant), in: .projects)
        case "flows":
            if parts.count >= 2 { open(.flow(tenantId: tenant, flowId: parts[1]), in: .projects) } else { open(.flows(tenantId: tenant), in: .projects) }
        case "wiki":
            if parts.count >= 2 { open(.wikiPage(tenantId: tenant, docId: parts[1]), in: .projects) } else { open(.wiki(tenantId: tenant), in: .projects) }
        case "notifications":
            select(.inbox)
        case "focus":
            isFocusRoomOpen = true
        case "capture":
            let items = components?.queryItems
            onCapture?(CaptureContext(projectId: items?.first(where: { $0.name == "project" })?.value,
                                      initialText: items?.first(where: { $0.name == "text" })?.value))
        case "ask":
            pendingAsk = components?.queryItems?.first(where: { $0.name == "q" })?.value ?? ""
        case "catalog":
            #if DEBUG
            open(.designCatalog, in: .today)
            #endif
        case "invite" where parts.count >= 3:
            pendingInvite = InviteLink(tenantId: parts[1], inviteId: parts[2])
        case "personal-tasks" where parts.count >= 2:
            open(.personalTask(tenantId: tenant, id: parts[1]), in: .work)
        default:
            select(.today)
            todayMode = components?.queryItems?.first(where: { $0.name == "mode" })?.value == "close" ? .dayClose : .normal
        }
        return true
    }

    func reset() {
        stacks.values.forEach { $0.path.removeAll() }
        searchStack.path.removeAll()
        tab = .today
        isSearchActive = false
        isFocusRoomOpen = false
        isListColumnHidden = false
    }
}
