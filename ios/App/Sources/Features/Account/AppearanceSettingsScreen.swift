import SwiftUI
import PFDesign

/// Darstellung: theme (System/Hell/Dunkel), language (System/DE/EN) and the "Dunkler Fokus" option.
struct AppearanceSettingsScreen: View {
    @Environment(AppModel.self) private var model
    /// Read by the focus room: always dark while a focus runs.
    @AppStorage("pf.darkFocus") private var darkFocus = false
    @State private var theme = "system"
    @State private var language = "system"

    var body: some View {
        SettingsScaffold(title: L10n.t("account.appearance")) {
            PFSectionHeader(L10n.t("account.theme"))
            HStack(spacing: PFSpace.s) {
                ThemeSwatch(title: L10n.t("account.theme.system"), scheme: nil, isSelected: theme == "system") { setTheme("system") }
                ThemeSwatch(title: L10n.t("account.theme.light"), scheme: .light, isSelected: theme == "light") { setTheme("light") }
                ThemeSwatch(title: L10n.t("account.theme.dark"), scheme: .dark, isSelected: theme == "dark") { setTheme("dark") }
            }

            PFSectionHeader(L10n.t("account.language"))
            PFSegmented([
                ("system", L10n.t("account.language.system")), ("de", "Deutsch"), ("en", "English"),
            ], selection: Binding(get: { language }, set: { setLanguage($0) }))

            PFSectionHeader(L10n.t("account.focus"))
            SettingsCard(footer: L10n.t("account.darkFocus.footer")) {
                SettingsSwitchRow(title: L10n.t("account.darkFocus"), isOn: $darkFocus)
            }
        }
        .onAppear(perform: syncFromProfile)
        .onChange(of: model.profile?.theme) { _, _ in syncFromProfile() }
    }

    private func syncFromProfile() {
        let profileTheme = model.profile?.theme
        theme = profileTheme == "light" || profileTheme == "dark" ? profileTheme! : "system"
        let profileLanguage = model.profile?.language
        language = profileLanguage == "de" || profileLanguage == "en" ? profileLanguage! : "system"
    }

    private func setTheme(_ value: String) {
        guard value != theme else { return }
        PFHaptics.selection()
        withAnimation(PFMotion.respecting(PFMotion.snappy)) { theme = value }
        Task { await model.perform { try await model.profileActions?.setTheme(value) } }
    }

    private func setLanguage(_ value: String) {
        guard value != language else { return }
        language = value
        // Applied before the profile write so the shell rebuilt by the profile change already uses it.
        switch value {
        case "de": L10n.language = .de
        case "en": L10n.language = .en
        default: L10n.language = (Locale.preferredLanguages.first ?? "de").hasPrefix("de") ? .de : .en
        }
        Task { await model.perform { try await model.profileActions?.setLanguage(value) } }
    }
}

/// Mini preview of a theme, drawn with the real tokens in a forced colour scheme ("System" is split in half).
private struct ThemeSwatch: View {
    let title: String
    let scheme: ColorScheme?
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: PFSpace.xs) {
                ZStack {
                    if let scheme {
                        mini.environment(\.colorScheme, scheme)
                    } else {
                        mini.environment(\.colorScheme, .light)
                        mini.environment(\.colorScheme, .dark)
                            .mask(alignment: .trailing) { Rectangle().frame(width: 50) }
                    }
                }
                .frame(height: 96)
                .clipShape(.rect(cornerRadius: PFRadius.card, style: .continuous))
                // Selected preview sits in a sunken well instead of an outline.
                .padding(5)
                .pfSunken(isSelected, in: .rect(cornerRadius: PFRadius.card + 5, style: .continuous))
                Text(title).pfText(.buttonSmall).foregroundStyle(isSelected ? PFColor.textMain : PFColor.textMuted)
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.pfPressable)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    private var mini: some View {
        ZStack(alignment: .topLeading) {
            PFColor.canvas
            VStack(alignment: .leading, spacing: 6) {
                Capsule().fill(PFColor.textMain).frame(width: 34, height: 6)
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 5) {
                        Circle().strokeBorder(PFColor.danger, lineWidth: 1.5).frame(width: 9, height: 9)
                        Capsule().fill(PFColor.textMain.opacity(0.8)).frame(width: 30, height: 4)
                    }
                    HStack(spacing: 5) {
                        Circle().strokeBorder(PFColor.warning, lineWidth: 1.5).frame(width: 9, height: 9)
                        Capsule().fill(PFColor.textMuted).frame(width: 22, height: 4)
                    }
                }
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(PFColor.card, in: .rect(cornerRadius: 8, style: .continuous))
            }
            .padding(10)
        }
    }
}
