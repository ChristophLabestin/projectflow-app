import Foundation

enum WorkspaceThresholds {
    private static let dueSoonDaysKey = "workspaceDueSoonDays"
    private static let overdueGraceDaysKey = "workspaceOverdueGraceDays"

    static var dueSoonDays: Int {
        get {
            let stored = UserDefaults.standard.integer(forKey: dueSoonDaysKey)
            return stored > 0 ? stored : 7
        }
        set {
            UserDefaults.standard.set(max(1, newValue), forKey: dueSoonDaysKey)
        }
    }

    static var overdueGraceDays: Int {
        get {
            let stored = UserDefaults.standard.integer(forKey: overdueGraceDaysKey)
            return stored >= 0 ? stored : 0
        }
        set {
            UserDefaults.standard.set(max(0, newValue), forKey: overdueGraceDaysKey)
        }
    }
}
