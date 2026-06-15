import SwiftUI
import FirebaseAuth

// MARK: - SettingsView — Companion V2

struct SettingsView: View {
    @Environment(\.colorScheme) private var colorScheme
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var appSession: AppSession

    @StateObject private var workspaceStore = WorkspaceStore()
    @State private var displayName: String = ""
    @State private var bio: String = ""
    @State private var isEditing = false

    private var colors: PFColors { PFColors.palette(for: colorScheme) }

    enum AppTheme: String, CaseIterable, Identifiable {
        case system = "System"
        case light = "Light"
        case dark = "Dark"
        var id: String { rawValue }
        var label: String {
            switch self {
            case .system: return L10n.tr("settings.theme.system", fallback: "System")
            case .light: return L10n.tr("settings.theme.light", fallback: "Light")
            case .dark: return L10n.tr("settings.theme.dark", fallback: "Dark")
            }
        }
    }

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView(showsIndicators: false) {
                VStack(alignment: .leading, spacing: PFSpacing.lg) {
                    PFScreenHeader(title: L10n.tr("settings.title", fallback: "Settings"))
                    profileCard
                    workspaceSection
                    appearanceSection
                    languageSection
                    thresholdsSection
                    moreSection
                    aboutSection
                    PFPrimaryButton(title: L10n.tr("settings.signOut", fallback: "Sign out"), action: { session.signOut() })
                        .padding(.top, PFSpacing.sm)
                }
                .pfScreenPadding(vertical: PFSpacing.md)
                .pfTabBarClearance()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            if let uid = session.user?.uid { workspaceStore.start(userId: uid) }
        }
        .onDisappear { workspaceStore.stop() }
    }

    // MARK: Profile

    private var profileCard: some View {
        PFCard {
            VStack(alignment: .leading, spacing: PFSpacing.md) {
                HStack(spacing: PFSpacing.md) {
                    UserAvatar(
                        name: session.userProfile?.displayName ?? session.user?.email,
                        url: session.user?.photoURL,
                        size: 60
                    )
                    VStack(alignment: .leading, spacing: 4) {
                        if isEditing {
                            TextField(L10n.tr("settings.displayName", fallback: "Display name"), text: $displayName)
                                .textFieldStyle(.roundedBorder)
                        } else {
                            Text(session.userProfile?.displayName ?? "User")
                                .font(PFFont.section)
                                .foregroundStyle(colors.textMain)
                        }
                        Text(session.user?.email ?? "")
                            .font(PFFont.detail)
                            .foregroundStyle(colors.textMuted)
                    }
                    Spacer()
                    Button {
                        if isEditing {
                            Task { await saveProfile() }
                        } else {
                            displayName = session.userProfile?.displayName ?? ""
                            bio = session.userProfile?.bio ?? ""
                            isEditing = true
                        }
                    } label: {
                        Image(systemName: isEditing ? "checkmark.circle.fill" : "pencil.circle.fill")
                            .font(.title2)
                            .foregroundStyle(colors.primary)
                    }
                }

                if isEditing {
                    VStack(alignment: .leading, spacing: PFSpacing.xs) {
                        PFFieldLabel(text: L10n.tr("settings.bio", fallback: "Bio"))
                        PFTextField(placeholder: L10n.tr("settings.bio", fallback: "Bio"), text: $bio, axis: .vertical)
                    }
                } else if let bioText = session.userProfile?.bio, !bioText.isEmpty {
                    Text(bioText)
                        .font(PFFont.body)
                        .foregroundStyle(colors.textSubtle)
                        .lineLimit(3)
                }
            }
        }
    }

    // MARK: Workspace

    private var workspaceSection: some View {
        section(title: L10n.tr("settings.workspace", fallback: "Workspace")) {
            PFCard {
                VStack(alignment: .leading, spacing: PFSpacing.md) {
                    if workspaceStore.isLoading {
                        ProgressView()
                    } else {
                        ForEach(workspaceStore.workspaces) { workspace in
                            Button { switchWorkspace(to: workspace.id) } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(workspace.name)
                                            .font(PFFont.rowTitle)
                                            .foregroundStyle(colors.textMain)
                                        Text("\(workspace.planTier) • \(workspace.role)")
                                            .font(PFFont.detail)
                                            .foregroundStyle(colors.textMuted)
                                    }
                                    Spacer()
                                    let activeWorkspaceId = appSession.activeTenantId
                                        ?? UserDefaults.standard.string(forKey: TenantResolver.activeTenantKey)
                                    if activeWorkspaceId == workspace.id {
                                        Image(systemName: "checkmark.circle.fill").foregroundStyle(colors.success)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                            if workspace.id != workspaceStore.workspaces.last?.id { Divider() }
                        }
                    }
                }
            }
        }
    }

    // MARK: Appearance / Language / Thresholds

    private var appearanceSection: some View {
        section(title: L10n.tr("settings.appearance", fallback: "Appearance")) {
            PFCard {
                Picker(L10n.tr("settings.theme", fallback: "Theme"), selection: themeBinding) {
                    ForEach(AppTheme.allCases) { theme in
                        Text(theme.label).tag(theme)
                    }
                }
                .pickerStyle(.segmented)
            }
        }
    }

    private var languageSection: some View {
        section(title: L10n.tr("settings.language", fallback: "Language")) {
            PFCard {
                Picker(L10n.tr("settings.language", fallback: "Language"), selection: languageBinding) {
                    Text(L10n.tr("settings.language.en", fallback: "English")).tag("en")
                    Text(L10n.tr("settings.language.de", fallback: "Deutsch")).tag("de")
                }
                .pickerStyle(.segmented)
            }
        }
    }

    private var thresholdsSection: some View {
        section(title: L10n.tr("settings.thresholds", fallback: "Workload thresholds")) {
            PFCard {
                Stepper(value: dueSoonDaysBinding, in: 1...30, step: 1) {
                    Text("\(L10n.tr("settings.dueSoonDays", fallback: "Due soon window (days)")): \(dueSoonDaysBinding.wrappedValue)")
                        .font(PFFont.body)
                        .foregroundStyle(colors.textMain)
                }
            }
        }
    }

    // MARK: More

    private var moreSection: some View {
        section(title: L10n.tr("settings.more", fallback: "More")) {
            VStack(spacing: PFSpacing.sm) {
                navRow(title: L10n.tr("settings.calendar", fallback: "Calendar"), icon: "calendar") { CalendarView() }
                navRow(title: L10n.tr("settings.team", fallback: "Team"), icon: "person.3") { TeamView() }
                navRow(title: L10n.tr("settings.styleGuide", fallback: "Style guide"), icon: "paintpalette") { StyleGuideView() }
            }
        }
    }

    private func navRow<Destination: View>(title: String, icon: String, @ViewBuilder destination: @escaping () -> Destination) -> some View {
        NavigationLink { destination() } label: {
            PFCard {
                PFListRow(title: title, icon: icon, iconTint: colors.primary)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: About

    private var aboutSection: some View {
        section(title: L10n.tr("settings.about", fallback: "About")) {
            PFCard {
                VStack(spacing: 0) {
                    aboutRow(label: L10n.tr("settings.version", fallback: "Version"), value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0")
                    Divider().padding(.vertical, PFSpacing.sm)
                    aboutRow(label: L10n.tr("settings.build", fallback: "Build"), value: Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1")
                }
            }
        }
    }

    private func aboutRow(label: String, value: String) -> some View {
        HStack {
            Text(label).font(PFFont.body).foregroundStyle(colors.textMain)
            Spacer()
            Text(value).font(PFFont.body).foregroundStyle(colors.textMuted)
        }
    }

    // MARK: Helpers

    @ViewBuilder
    private func section<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: PFSpacing.sm) {
            PFSectionTitle(title: title)
            content()
        }
    }

    private var themeBinding: Binding<AppTheme> {
        Binding(
            get: {
                switch appSession.appTheme.lowercased() {
                case "light": return .light
                case "dark": return .dark
                default: return .system
                }
            },
            set: { appSession.setTheme($0.rawValue.lowercased()) }
        )
    }

    private var languageBinding: Binding<String> {
        Binding(get: { appSession.appLanguage }, set: { appSession.setLanguage($0) })
    }

    private var dueSoonDaysBinding: Binding<Int> {
        Binding(get: { WorkspaceThresholds.dueSoonDays }, set: { WorkspaceThresholds.dueSoonDays = $0 })
    }

    private func saveProfile() async {
        await session.updateProfile(displayName: displayName, bio: bio)
        isEditing = false
    }

    private func switchWorkspace(to tenantId: String) {
        TenantResolver.setActiveTenantId(tenantId)
        AppSession.shared.switchWorkspace(to: tenantId)
    }
}
