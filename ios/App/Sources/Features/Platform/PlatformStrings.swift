// Copy for platform signals from the admin console (workspace suspension, announcement banner), DE/EN.
// Wording matches web/desktop (`web/context/WorkspaceContext.tsx`, admin-console iOS contract).
enum PlatformStrings {
    static let de: [String: String] = [
        "platform.suspended.title": "Workspace „{name}“ ist gesperrt",
        "platform.suspended.message": "Dieser Workspace wurde von ProjectFlow gesperrt. Projekte, Aufgaben und Dateien sind bis zur Freigabe nicht verfügbar. Dein Konto und deine anderen Workspaces sind nicht betroffen.",
        "platform.suspended.switch": "Zu einem anderen Workspace wechseln",
        "platform.suspended.support": "Support kontaktieren",
        "platform.suspended.signOut": "Abmelden",
        "platform.announcement.dismiss": "Hinweis ausblenden",
        "platform.announcement.info": "Hinweis", "platform.announcement.maintenance": "Wartung", "platform.announcement.warning": "Warnung",
    ]

    static let en: [String: String] = [
        "platform.suspended.title": "Workspace “{name}” is suspended",
        "platform.suspended.message": "This workspace has been suspended by ProjectFlow. Its projects, tasks and files are not available until it is released. Your account and your other workspaces are not affected.",
        "platform.suspended.switch": "Switch to another workspace",
        "platform.suspended.support": "Contact support",
        "platform.suspended.signOut": "Sign out",
        "platform.announcement.dismiss": "Dismiss notice",
        "platform.announcement.info": "Notice", "platform.announcement.maintenance": "Maintenance", "platform.announcement.warning": "Warning",
    ]
}
