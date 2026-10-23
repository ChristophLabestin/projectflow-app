import SwiftUI
import UserNotifications
import PFData
import PFDesign
import PFModel

/// Mitteilungen (contract C3): push/email per category, morning briefing, day close, time zone, system permission.
struct NotificationSettingsScreen: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.openURL) private var openURL
    @AppStorage("pf.timezone.auto") private var timezoneAuto = true
    @State private var prefs = NotificationPrefs(fields: nil)
    @State private var isLoaded = false
    @State private var permission: UNAuthorizationStatus = .notDetermined

    private typealias Prefs = WritableKeyPath<NotificationPrefs, Bool>

    private func bind(_ keyPath: Prefs) -> Binding<Bool> {
        Binding(get: { prefs[keyPath: keyPath] }, set: { prefs[keyPath: keyPath] = $0 })
    }

    var body: some View {
        SettingsScaffold(title: L10n.t("account.notifications")) {
            PFSectionHeader(L10n.t("notify.device"))
            deviceCard

            PFSectionHeader(L10n.t("notify.push"))
            SettingsCard(footer: L10n.t("notify.push.footer")) {
                SettingsSwitchRow(title: L10n.t("notify.cat.assignments"), isOn: bind(\.push.assignments))
                SettingsSwitchRow(title: L10n.t("notify.cat.mentions"), isOn: bind(\.push.mentions))
                SettingsSwitchRow(title: L10n.t("notify.cat.comments"), isOn: bind(\.push.comments))
                SettingsSwitchRow(title: L10n.t("notify.cat.due"), isOn: bind(\.push.due))
                SettingsSwitchRow(title: L10n.t("notify.cat.reminders"), isOn: bind(\.push.reminders))
            }

            PFSectionHeader(L10n.t("notify.email"))
            SettingsCard {
                SettingsSwitchRow(title: L10n.t("notify.cat.assignments"), isOn: bind(\.email.assignments))
                SettingsSwitchRow(title: L10n.t("notify.cat.mentions"), isOn: bind(\.email.mentions))
                SettingsSwitchRow(title: L10n.t("notify.cat.comments"), isOn: bind(\.email.comments))
                SettingsSwitchRow(title: L10n.t("notify.cat.due"), isOn: bind(\.email.due))
                SettingsSwitchRow(title: L10n.t("notify.cat.reminders"), isOn: bind(\.email.reminders))
            }

            PFSectionHeader(L10n.t("notify.rhythm"))
            SettingsCard(footer: L10n.t("notify.rhythm.footer")) {
                SettingsSwitchRow(title: L10n.t("notify.briefing"), subtitle: L10n.t("notify.briefing.subtitle"), isOn: bind(\.morningBriefing.enabled))
                if prefs.morningBriefing.enabled {
                    SettingsTimeRow(title: L10n.t("notify.time"), time: Binding(get: { prefs.morningBriefing.time }, set: { prefs.morningBriefing.time = $0 }))
                }
                SettingsSwitchRow(title: L10n.t("notify.dayClose"), subtitle: L10n.t("notify.dayClose.subtitle"), isOn: bind(\.dayClose.enabled))
                if prefs.dayClose.enabled {
                    SettingsTimeRow(title: L10n.t("notify.time"), time: Binding(get: { prefs.dayClose.time }, set: { prefs.dayClose.time = $0 }))
                }
            }

            PFSectionHeader(L10n.t("notify.timezone"))
            SettingsCard(footer: L10n.t("notify.timezone.footer")) {
                SettingsRow(systemImage: "globe", title: prefs.timezone, showsChevron: false)
                SettingsSwitchRow(title: L10n.t("notify.timezone.auto"), isOn: $timezoneAuto)
            }
        }
        .task {
            load()
            await refreshPermission()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active { Task { await refreshPermission() } }
        }
        .onChange(of: prefs) { _, new in commit(new) }
        .onChange(of: timezoneAuto) { _, auto in
            if auto { prefs.timezone = TimeZone.current.identifier }
        }
    }

    // MARK: Device permission

    private var deviceCard: some View {
        SettingsCard {
            SettingsRow(systemImage: "bell.badge", title: L10n.t("notify.device.title"), subtitle: permissionText, showsChevron: false) {
                switch permission {
                case .authorized, .provisional, .ephemeral:
                    SettingsStateLabel(text: L10n.t("notify.permission.on"), tone: .good)
                case .denied:
                    PFButton(L10n.t("notify.permission.openSettings"), kind: .ghost, size: .small) {
                        if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                    }
                default:
                    PFButton(L10n.t("notify.permission.allow"), size: .small) {
                        Task {
                            await PushRegistrar.shared.requestPermissionIfNeeded()
                            await refreshPermission()
                        }
                    }
                }
            }
        }
    }

    private var permissionText: String {
        switch permission {
        case .authorized, .provisional, .ephemeral: L10n.t("notify.permission.onText")
        case .denied: L10n.t("notify.permission.deniedText")
        default: L10n.t("notify.permission.askText")
        }
    }

    private func refreshPermission() async {
        permission = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }

    // MARK: Prefs

    private func load() {
        var loaded = model.profile?.notificationPrefs ?? NotificationPrefs(fields: nil)
        if timezoneAuto { loaded.timezone = TimeZone.current.identifier }
        prefs = loaded
        DispatchQueue.main.async { isLoaded = true }
    }

    private func commit(_ new: NotificationPrefs) {
        guard isLoaded, new != model.profile?.notificationPrefs else { return }
        var toWrite = new
        if timezoneAuto { toWrite.timezone = TimeZone.current.identifier }
        Task { await model.perform { try await model.profileActions?.setNotificationPrefs(toWrite) } }
    }
}
